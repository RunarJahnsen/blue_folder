export interface Group {
  id: string;
  name: string;
  access_code: string;
  created_at: string;
}

export interface Room {
  id: string;
  group_id: string;
  title: string;
  date: string;
  status: 'planned' | 'active' | 'completed';
  mode: 'host_only' | 'suggest' | 'open';
  current_queue_item_id?: string;
  join_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  group_id: string;
  title: string;
  url: string;
  source_label?: string;
  created_at: string;
  updated_at: string;
}

export interface RoomSongEntry {
  id: string;
  group_id: string;
  room_id: string;
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

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: Group;
        Insert: Omit<Group, 'id' | 'created_at'>;
        Update: Partial<Omit<Group, 'id' | 'created_at'>>;
      };
      rooms: {
        Row: Room;
        Insert: Omit<Room, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Room, 'id' | 'created_at' | 'updated_at'>>;
      };
      songs: {
        Row: Song;
        Insert: Omit<Song, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Song, 'id' | 'created_at' | 'updated_at'>>;
      };
      room_song_entries: {
        Row: RoomSongEntry;
        Insert: Omit<RoomSongEntry, 'id' | 'added_at'>;
        Update: Partial<Omit<RoomSongEntry, 'id' | 'added_at'>>;
      };
      favorites: {
        Row: Favorite;
        Insert: Omit<Favorite, 'id' | 'created_at'>;
        Update: Partial<Omit<Favorite, 'id' | 'created_at'>>;
      };
    };
  };
};