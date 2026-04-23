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