interface HistoryEntry {
    from: string;
    to: string;
    data: any;
}

let history: HistoryEntry[] = [];

export function resetHistory(): void {
    history = [];
}

export function getHistory(): HistoryEntry[] {
    return history;
}

export function addEntry(entry: HistoryEntry): void {
    history.push(entry);
}
