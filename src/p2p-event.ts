export interface P2PEvent<TPayload> {
    eventId: string;
    serialId: string;
    originUserId: string;
    createdDate: number;
    payload: TPayload;
}