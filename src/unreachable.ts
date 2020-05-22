export function unreachable(arg: never): never {
    throw new Error(`Unreachable code: "${arg}" was not expected.`);
}

