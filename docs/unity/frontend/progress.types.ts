export interface CoalescedProgressEntry {
 stepId:string;objectId:string;workItemId:string;action:string;attemptId:string|null;requestRevision:number|null;documentRevision:number;
 input:Record<string,unknown>&{draftRevision:number;savedRevision:number;savedRequestRevision:number|null};
}
export interface CoalescedEventData {coalescedProgress?:CoalescedProgressEntry[];[key:string]:unknown}
// Revision fields mirror the actual PilotLedger payload; this is a snapshot, not an extra action event.
