interface HistoryEntry {
    from: string;
    to: string;
    data: any;
}

let history: HistoryEntry[] = [];

export function resetHistory() {
    history = [];
}

export function getHistory() {
    return history;
}

export function addEntry(entry: HistoryEntry) {
    history.push(entry);
}
