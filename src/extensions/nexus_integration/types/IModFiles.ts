export interface IFileInfo {
  file_id: number;
  category_id: number;
  category_name: string;
  name: string;
  version: string;
  size: number;
  file_name: string;
  uploaded_timestamp: number;
  uploaded_time: string;
  mod_version: string;
  external_virus_scan_url: string;
  is_primary: boolean;
}

export interface IModFiles {
  file_updates: IFileUpdates[];
  files: IFileInfo[];
}

export interface IFileUpdates {
  new_file_id: number;
  new_file_name: string;
  old_file_id: number;
  old_file_name: string;
  uploaded_time: string;
  uploaded_timestamp: number;
}
