export interface Message<TPayload> {
    eventId: string;
    serialId: string;
    originUserId: string;
    createdDate: number;
    payload: TPayload;
}