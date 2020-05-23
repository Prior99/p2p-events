export interface Message<TMessageType extends string | number, TPayload> {
    messageType: TMessageType;
    serialId: string;
    originUserId: string;
    createdDate: number;
    payload: TPayload;
}