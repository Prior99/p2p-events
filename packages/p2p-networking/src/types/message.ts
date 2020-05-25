/**
 * An individual message sent from one client to others.
 */
export interface Message<TMessageType extends string | number, TPayload> {
    /**
     * The type of the message. Determining the handler to trigger.
     */
    messageType: TMessageType;
    /**
     * An unique serial id for this individual message instance.
     */
    serialId: string;
    /**
     * Id of the user that sent this message.
     */
    originUserId: string;
    /**
     * Unix timestamp in milliseconds of the time the message was sent.
     */
    createdDate: number;
    /**
     * The message's payload.
     */
    payload: TPayload;
}