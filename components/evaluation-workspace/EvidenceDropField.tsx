"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import styles from "./evaluation-workspace.module.css";

type StagedFile={name:string;kind:"CSV"|"Excel"|"PDF"|"Word"|"Text"};
type Props={acceptDocuments?:boolean;actionLabel?:string;dropLabel?:string;initialNotice?:string};

function fileKind(name:string,acceptDocuments:boolean):StagedFile["kind"]|null{
  const value=name.toLowerCase();
  if(value.endsWith(".csv"))return "CSV";
  if(value.endsWith(".xlsx")||value.endsWith(".xls"))return "Excel";
  if(acceptDocuments&&value.endsWith(".pdf"))return "PDF";
  if(acceptDocuments&&(value.endsWith(".doc")||value.endsWith(".docx")))return "Word";
  if(acceptDocuments&&(value.endsWith(".txt")||value.endsWith(".md")))return "Text";
  return null;
}

export function EvidenceDropField({acceptDocuments=false,actionLabel="Add evidence",dropLabel="Drop CSV or Excel",initialNotice="Local staging only"}:Props={}){
  const [stagedFiles,setStagedFiles]=useState<StagedFile[]>([]);
  const [notice,setNotice]=useState(initialNotice);
  const inputRef=useRef<HTMLInputElement>(null);
  const acceptedTypes=acceptDocuments
    ? ".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt,.md,text/csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : ".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  function stage(files:FileList|File[]){
    const accepted=Array.from(files).map((file)=>({name:file.name,kind:fileKind(file.name,acceptDocuments)})).filter((item):item is StagedFile=>item.kind!==null);
    if(!accepted.length){setNotice(acceptDocuments?"Use CSV, Excel, PDF, Word, or text":"Use CSV, XLSX, or XLS");return;}
    setStagedFiles((current)=>[...current,...accepted].slice(0,5));
    setNotice("Staged · review fields before mapping");
  }
  function onFiles(event:ChangeEvent<HTMLInputElement>){if(event.target.files)stage(event.target.files);event.target.value="";}
  function onDrop(event:DragEvent<HTMLDivElement>){event.preventDefault();stage(event.dataTransfer.files);}

  return <section className={styles.evidenceDropField} aria-label="Add evidence files">
    <div className={styles.compactDropzone} onDragOver={(event)=>event.preventDefault()} onDrop={onDrop} role="button" tabIndex={0} onClick={()=>inputRef.current?.click()} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" ")inputRef.current?.click();}}>
      <input ref={inputRef} type="file" accept={acceptedTypes} multiple onChange={onFiles}/>
      <span>{actionLabel}</span><b>{dropLabel}</b><small>{notice}</small>
    </div>
    {stagedFiles.length>0&&<div className={styles.compactFiles}>{stagedFiles.map((file,index)=><span key={`${file.name}-${index}`} title={file.name}><i>{file.kind}</i>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={()=>setStagedFiles((current)=>current.filter((_,itemIndex)=>itemIndex!==index))}>×</button></span>)}</div>}
  </section>;
}
