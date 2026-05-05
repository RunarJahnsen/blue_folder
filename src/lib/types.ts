export interface Group {
  id: string;
  name: string;
  access_code: string;
  created_at: string;
}

export interface Folder {
  id: string;
  group_id: string;
  title: string;
  date: string;
  status: 'planned' | 'active' | 'completed';
  mode: 'host_only' | 'suggest' | 'open';
  current_queue_item_id?: string;
  owner_user_id?: string;
  join_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  group_id: string;
  title: string;
  artist?: string;
  url: string;
  content?: string;
  source_label?: string;
  created_at: string;
  updated_at: string;
}

export interface FolderSongEntry {
  id: string;
  group_id: string;
  folder_id: string;
  song_id: string;
  state: 'suggested' | 'queued' | 'current' | 'played' | 'removed';
  position?: number;
  added_by_session_id?: string;
  added_at: string;
  started_at?: string;
  played_at?: string;
  removed_at?: string;
}

export interface Favorite {
  id: string;
  group_id: string;
  song_id: string;
  created_at: string;
}

export interface Tag {
  id: string;
  group_id: string;
  name: string;
  created_at: string;
}

export interface SongTagEntry {
  id: string;
  song_id: string;
  tag_id: string;
  group_id: string;
  tags: Tag;
}

export interface SongWithTags extends Song {
  song_tags?: SongTagEntry[];
}

export interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  username: string;
  role: 'admin' | 'member';
  created_at: string;
  groups?: { id: string; name: string };
}

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: Group;
        Insert: Omit<Group, 'id' | 'created_at'>;
        Update: Partial<Omit<Group, 'id' | 'created_at'>>;
      };
      folders: {
        Row: Folder;
        Insert: Omit<Folder, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Folder, 'id' | 'created_at' | 'updated_at'>>;
      };
      songs: {
        Row: Song;
        Insert: Omit<Song, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Song, 'id' | 'created_at' | 'updated_at'>> & { content?: string | null };
      };
      folder_song_entries: {
        Row: FolderSongEntry;
        Insert: Omit<FolderSongEntry, 'id' | 'added_at'>;
        Update: Partial<Omit<FolderSongEntry, 'id' | 'added_at'>>;
      };
      favorites: {
        Row: Favorite;
        Insert: Omit<Favorite, 'id' | 'created_at'>;
        Update: Partial<Omit<Favorite, 'id' | 'created_at'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};