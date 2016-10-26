export interface IValidateKeyResponse {
    user_id: number;
    key: string;
    name: string;
    is_premium: boolean;
    is_supporter: boolean;
    email: string;
    url: string;
}
export interface IGetModInfoResponse {
    id: number;
    category_id: number;
    adult: number;
    type: number;
    name: string;
    summary: string;
    description: string;
    version: string;
    author: string;
}
export interface IDownloadURL {
    URI: string;
    IsPremium: boolean;
    Name: string;
    Country: string;
    ConnectedUsers: number;
}
