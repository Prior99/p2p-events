/**
 * Reason for the error.
 */
export const enum ErrorReason {
    /**
     * Error was caused by network problems.
     */
    NETWORK = "network",
    /**
     * Error was caused by internal library or protocol bugs.
     */
    INTERNAL = "internal",
    /**
     * Error hat generic reason.
     */
    OTHER = "other",
    /**
     * Error was caused by incompatible application or library versions.
     */
    INCOMPATIBLE = "incompatible",
} 