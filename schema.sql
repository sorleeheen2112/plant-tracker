-- SQL Database Schema for Plant Tracker SaaS Application
-- Copy and paste this directly into the Supabase SQL Editor.

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
-- Holds custom user preferences and links directly to Supabase Auth users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  avatar_url text,
  language text default 'en' check (language in ('en', 'th')) not null,
  theme text default 'system' check (theme in ('light', 'dark', 'system')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Allow profile read for profile owners" on public.profiles
  for select using (auth.uid() = id);

create policy "Allow profile update for profile owners" on public.profiles
  for update using (auth.uid() = id);

create policy "Allow profile insert for profile owners" on public.profiles
  for insert with check (auth.uid() = id);

-- Trigger to automatically create a public profile record when a user registers on Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url, language, theme)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url', 
      'https://api.dicebear.com/7.x/adventurer/svg?seed=' || new.id::text
    ),
    'th',
    'system'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. GARDENS TABLE
-- Groups plants into specific physical gardens (e.g. Home, Balcony, Vegetable)
create table public.gardens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  cover_image text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Gardens
alter table public.gardens enable row level security;

-- Policies for Gardens
create policy "Allow all garden actions for owners" on public.gardens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 3. PLANTS TABLE
-- Tracks individual plants, their status, garden, and location
create table public.plants (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  garden_id uuid references public.gardens(id) on delete set null,
  name text not null,
  species text not null,
  location text,
  planting_date date not null,
  status text check (status in ('healthy', 'flowering', 'fruiting', 'dormant', 'sick')) not null,
  notes text,
  cover_image text,
  archived boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Plants
alter table public.plants enable row level security;

-- Policies for Plants
create policy "Allow all plant actions for owners" on public.plants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 4. ACTIVITIES TABLE
-- Timeline logs of gardening interactions (e.g. watered, fertilized)
create table public.activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plant_id uuid references public.plants(id) on delete cascade not null,
  type text check (type in ('watering', 'fertilizing', 'pruning', 'repotting', 'pest_control', 'observation', 'flowering', 'harvest')) not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  details text,
  notes text,
  photo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Activities
alter table public.activities enable row level security;

-- Policies for Activities
create policy "Allow all activity actions for owners" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 5. SCHEDULES TABLE
-- Defines recurring intervals for tasks. Next due dates are computed on client: last_performed + interval_days
create table public.schedules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plant_id uuid references public.plants(id) on delete cascade not null,
  type text check (type in ('watering', 'fertilizing', 'pruning', 'repotting', 'pest_control', 'observation', 'flowering', 'harvest')) not null,
  interval_days integer check (interval_days > 0) not null,
  start_date date not null,
  last_performed timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Schedules
alter table public.schedules enable row level security;

-- Policies for Schedules
create policy "Allow all schedule actions for owners" on public.schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 6. NOTIFICATIONS TABLE
-- Persistent notifications pushed to the user's dashboard (e.g. system warnings, alerts)
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title_en text not null,
  title_th text not null,
  message_en text not null,
  message_th text not null,
  type text check (type in ('due', 'upcoming', 'overdue')) not null,
  read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Notifications
alter table public.notifications enable row level security;

-- Policies for Notifications
create policy "Allow all notification actions for owners" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
