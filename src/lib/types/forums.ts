export type Thread = {
  id: number;
  title: string;
  body: string;
  author_id: number;
  author_name: string;
  created_at: string;
  updated_at: string;
  last_comment_at: string | null;
  comments_count: number;
};

export type Comment = {
  id: number;
  thread_id: number;
  author_id: number;
  author_name: string;
  parent_id: number | null;
  body: string;
  created_at: string;
  updated_at: string;
};
