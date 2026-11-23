// Client Hub upload limit, shared by the server check (lib/portal/files.ts)
// and the admin forms (checked in the browser before sending). 10 MB
// (decimal) leaves room under Next's 10 MiB Server Action body limit
// (next.config.ts serverActions.bodySizeLimit "10mb") for the other fields.
export const MAX_FILE_BYTES = 10_000_000;
export const MAX_FILE_LABEL = "10 MB";
