/**
 * KashurEditor.jsx — v12 FINAL
 * Fixes: Tab visibility, Ribbon UI, Undo/Redo across pages,
 * Cursor jump, Find highlights persist, Table toolbar,
 * Spell check, Paragraph styles, Numbered headings, DOCX export
 * NEW v10: Live Editable Charts, Table of Contents, Comments & Review, Image Editor
 * ADDITIONS v7:
 * ✅ Shapes (Rectangle, Circle, Triangle, Star, Arrow, Diamond)
 * ✅ Charts (Bar, Pie, Line) as inline SVG
 * ✅ Header (editable text at top of every page)
 * ✅ Footer (editable text at bottom of every page)
 * ✅ Page Number (shown in footer)
 * ✅ Page Border (double blue border around A4 page)
 */

import { useState, useEffect, useRef, useCallback, forwardRef } from "react"
import { createPortal, flushSync } from "react-dom"
import { useAuth } from "./auth-frontend/AuthContext"

const API_BASE = "http://localhost:3001/api"
const A4 = { portrait: { w: 794, h: 1122 }, landscape: { w: 1122, h: 794 } }

// ── MS Word 365 Authentic Color Tokens ──────────────────────────────────────
const WORD_BLUE      = "#185abd"   // Word's exact brand blue
const WORD_BLUE_DARK = "#103d82"   // Hover/darker shade
const RIBBON_BG      = "#f5f5f5"   // Ribbon panel background
const BORDER         = "#c8c8c8"   // General control border
const BTN_HOVER_BG   = "#e5efff"   // Button hover
const BTN_ACTIVE_BG  = "#cce0ff"   // Button active/pressed
const BTN_ACTIVE_BDR = "#185abd"   // Button active border
const GROUP_LABEL_C  = "#737373"   // Group label colour

// NOTE ON FONTS: every entry below is backed by a font that is actually
// loaded somewhere (either self-hosted via @font-face in index.css, or
// pulled from Google Fonts in the useEffect below) and is free/open
// licensed (SIL Open Font License, or freeware in Gulmarg/Narqalam's case).
// The previous list included several entries (Jameel Noori Nastaleeq, Mehr
// Nastaliq, Urdu Typesetting, Arial Unicode MS) that were never loaded
// anywhere and are proprietary Windows/commercial fonts most machines don't
// have installed — selecting them silently fell back to the browser
// default font, which looked like "the font isn't working".
let Kashur_FONTS = [
  { label: "Noto Nastaliq Urdu",  value: "'Noto Nastaliq Urdu', serif" },
  { label: "Noto Naskh Arabic (Naskh)", value: "'Noto Naskh Arabic', sans-serif" },
  { label: "Narqalam (local)",    value: "'Narqalam', 'Noto Naskh Arabic', serif" },
  { label: "Gulmarg Nastaleeq (local)", value: "'Gulmarg', 'Noto Nastaliq Urdu', serif" },
  { label: "Gulzar",              value: "'Gulzar', 'Noto Nastaliq Urdu', serif" },
  { label: "Reem Kufi",           value: "'Reem Kufi', 'Noto Kufi Arabic', sans-serif" },
  { label: "Vazirmatn",           value: "'Vazirmatn', 'Noto Naskh Arabic', sans-serif" },
  { label: "Noto Kufi Arabic",    value: "'Noto Kufi Arabic', sans-serif" },
  { label: "Rubik (English only)",value: "'Rubik', 'Noto Naskh Arabic', sans-serif" },
  { label: "Scheherazade New",    value: "'Scheherazade New', 'Noto Naskh Arabic', serif" },
  { label: "Amiri",               value: "'Amiri', 'Noto Naskh Arabic', serif" },
  { label: "Lateef",              value: "'Lateef', 'Noto Nastaliq Urdu', serif" },
  { label: "Cairo",               value: "'Cairo', 'Noto Kufi Arabic', sans-serif" },
  { label: "Tajawal",             value: "'Tajawal', 'Noto Naskh Arabic', sans-serif" },
  { label: "Kufam",               value: "'Kufam', 'Noto Kufi Arabic', sans-serif" },
  { label: "Aref Ruqaa",          value: "'Aref Ruqaa', 'Noto Naskh Arabic', serif" },
  { label: "IBM Plex Sans Arabic",value: "'IBM Plex Sans Arabic', sans-serif" },
  { label: "Readex Pro",          value: "'Readex Pro', 'Noto Naskh Arabic', sans-serif" },
  { label: "El Messiri",          value: "'El Messiri', 'Noto Naskh Arabic', sans-serif" },
  { label: "Baloo Bhaijaan 2",    value: "'Baloo Bhaijaan 2', 'Noto Naskh Arabic', sans-serif" },
  { label: "Georgia",             value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman",     value: "'Times New Roman', Times, serif" },
]
const primaryFontName=value=>(value||"").split(",")[0].replace(/['"]/g,"").trim().toLowerCase()
const uniqueFontList=fonts=>{
  const seen=new Set()
  return fonts.filter(font=>{
    const key=primaryFontName(font.value)||font.label.trim().toLowerCase()
    if(seen.has(key))return false
    seen.add(key)
    return true
  })
}
Kashur_FONTS=uniqueFontList(Kashur_FONTS)
const FONT_SIZES = [8,9,10,11,12,14,16,18,20,22,24,26,28,32,36,48,72]
const TABS = ["File","Home","Insert","Layout","Review","Comments","View"]
const DOCUMENT_THEMES={
  Office:{
    page:"#ffffff",text:"#1f3864",muted:"#5f6f86",
    accent1:"#4472c4",accent2:"#ed7d31",accent3:"#70ad47",
    headingFont:"'Noto Kufi Arabic', sans-serif",
    bodyFont:"'Noto Naskh Arabic', sans-serif",
  },
  Facet:{
    page:"#f7fbef",text:"#375623",muted:"#657453",
    accent1:"#90c226",accent2:"#2f5597",accent3:"#a5a5a5",
    headingFont:"'Reem Kufi', 'Noto Kufi Arabic', sans-serif",
    bodyFont:"'Vazirmatn', 'Noto Naskh Arabic', sans-serif",
  },
  Integral:{
    page:"#fff7e8",text:"#1f4e79",muted:"#6b6258",
    accent1:"#1f4e79",accent2:"#c65911",accent3:"#548235",
    headingFont:"'Aref Ruqaa', 'Noto Naskh Arabic', serif",
    bodyFont:"'Amiri', 'Noto Naskh Arabic', serif",
  },
  Ion:{
    page:"#eef7ff",text:"#244062",muted:"#5e7489",
    accent1:"#5b9bd5",accent2:"#ed7d31",accent3:"#a5a5a5",
    headingFont:"'El Messiri', 'Noto Naskh Arabic', sans-serif",
    bodyFont:"'Cairo', 'Noto Kufi Arabic', sans-serif",
  },
  Retrospect:{
    page:"#fbf2df",text:"#7f6000",muted:"#74665b",
    accent1:"#9e480e",accent2:"#997300",accent3:"#43682b",
    headingFont:"'Gulzar', 'Noto Nastaliq Urdu', serif",
    bodyFont:"'Scheherazade New', 'Noto Naskh Arabic', serif",
  },
  Slice:{
    page:"#fff2f2",text:"#7f0000",muted:"#725f5f",
    accent1:"#c00000",accent2:"#404040",accent3:"#7f7f7f",
    headingFont:"'Kufam', 'Noto Kufi Arabic', sans-serif",
    bodyFont:"'IBM Plex Sans Arabic', sans-serif",
  },
  Wisp:{
    page:"#edfffb",text:"#00665f",muted:"#5f7771",
    accent1:"#00b0a6",accent2:"#70ad47",accent3:"#4472c4",
    headingFont:"'Baloo Bhaijaan 2', 'Noto Naskh Arabic', sans-serif",
    bodyFont:"'Tajawal', 'Noto Naskh Arabic', sans-serif",
  },
  Berlin:{
    page:"#f2f4f8",text:"#203864",muted:"#626b7c",
    accent1:"#2f5597",accent2:"#c00000",accent3:"#7f6000",
    headingFont:"'Noto Kufi Arabic', sans-serif",
    bodyFont:"'Readex Pro', 'Noto Naskh Arabic', sans-serif",
  },
  Celestial:{
    page:"#edf7ff",text:"#1f4e79",muted:"#607b91",
    accent1:"#2e75b6",accent2:"#00b0f0",accent3:"#7030a0",
    headingFont:"'Reem Kufi', 'Noto Kufi Arabic', sans-serif",
    bodyFont:"'Lateef', 'Noto Nastaliq Urdu', serif",
  },
  Metropolitan:{
    page:"#fff1ee",text:"#7f3129",muted:"#765f5b",
    accent1:"#e84c3d",accent2:"#1f4e79",accent3:"#ffc000",
    headingFont:"'Gulzar', 'Noto Nastaliq Urdu', serif",
    bodyFont:"'Noto Nastaliq Urdu', serif",
  },
}
const FILE_MENU = [
  { label:"New",icon:"📄",shortcut:"Ctrl+N" },{ label:"Open",icon:"📂",shortcut:"Ctrl+O" },
  { label:"divider" },
  { label:"Save",icon:"💾",shortcut:"Ctrl+S" },{ label:"Save As",icon:"🗂️",shortcut:"Ctrl+Shift+S" },
  { label:"Rename",icon:"✏️",shortcut:"F2" },{ label:"Share",icon:"🔗",shortcut:"" },{ label:"divider" },
  { label:"Print",icon:"🖨",shortcut:"Ctrl+P" },{ label:"divider" },
  { label:"Export DOCX",icon:"📝",shortcut:"" },{ label:"Export PDF",icon:"📄",shortcut:"" },
  { label:"Export TXT",icon:"📃",shortcut:"" },{ label:"divider" },
  { label:"Properties",icon:"ℹ️",shortcut:"" },{ label:"Account Info",icon:"👤",shortcut:"" },
  { label:"divider" },{ label:"Close",icon:"✕",shortcut:"Ctrl+W" },
]
const LIST_TYPES = [
  // Bullets
  { label:"● Filled Disc",    ls:"disc",             tag:"ul", icon:"●" },
  { label:"○ Circle",         ls:"circle",           tag:"ul", icon:"○" },
  { label:"■ Filled Square",  ls:"square",           tag:"ul", icon:"■" },
  { label:"✓ Check Mark",     ls:"custom",           tag:"ul", icon:"✓", custom:"✓" },
  { label:"➤ Arrow",          ls:"custom",           tag:"ul", icon:"➤", custom:"➤" },
  { label:"❖ Diamond",        ls:"custom",           tag:"ul", icon:"❖", custom:"❖" },
  { label:"☑ Check Box",      ls:"custom",           tag:"ul", icon:"☑", custom:"☑" },
  { label:"★ Star",           ls:"custom",           tag:"ul", icon:"★", custom:"★" },
  // Numbered
  { label:"1. 2. 3.",         ls:"decimal",          tag:"ol", icon:"1." },
  { label:"1) 2) 3)",         ls:"decimal-paren",    tag:"ol", icon:"1)" },
  { label:"(1) (2) (3)",      ls:"decimal-brackets", tag:"ol", icon:"(1)" },
  { label:"I. II. III.",      ls:"upper-roman",      tag:"ol", icon:"I." },
  { label:"A. B. C.",         ls:"upper-alpha",      tag:"ol", icon:"A." },
  { label:"a) b) c)",         ls:"lower-alpha-paren",tag:"ol", icon:"a)" },
  { label:"a. b. c.",         ls:"lower-alpha",      tag:"ol", icon:"a." },
  { label:"i. ii. iii.",      ls:"lower-roman",      tag:"ol", icon:"i." },
  { label:"۱. ۲. ۳.",         ls:"custom-urdu",      tag:"ol", icon:"۱." },
]
const MULTILEVEL_TYPES = [
  {id:"mixed",tag:"ul",label:"Mixed bullets",preview:["◆","➤","▪"]},
  {id:"paren",tag:"ol",label:"1) a) i)",preview:["1)","a)","i)"]},
  {id:"outline",tag:"ol",label:"1 → 1.1 → 1.1.1",preview:["1.","1.1.","1.1.1."]},
  {id:"article",tag:"ol",label:"Article / Section",preview:["Article I","Section 1.01","(a)"]},
  {id:"headings",tag:"ol",label:"Heading numbering",preview:["1 Heading 1","1.1 Heading 2","1.1.1 Heading 3"]},
  {id:"legal",tag:"ol",label:"Legal headings",preview:["1. Heading 1","A. Heading 2","1. Heading 3"]},
  {id:"chapter",tag:"ol",label:"Chapter style",preview:["Chapter 1","Section 1.1","1.1.1"]},
]
const DEFAULT_HTML = `<p style="font-size:22px;font-weight:bold;text-align:right;direction:rtl;"></p><p>&nbsp;</p><p style="text-align:right;direction:rtl;"></p>`

const PHONETIC_MAP_RAW = {
  // Dynamic two-key combinations. Uppercase H means aspiration, so kH = کھ,
  // while lowercase kh remains the Arabic/Persian loan consonant خ.
  "pH":"پھ","bH":"بھ","tH":"تھ","TH":"ٹھ","cH":"چھ","kH":"کھ","ZH":"ژھ",
  "ph":"پھ","bh":"بھ","th":"تھ","ch":"چ","kh":"خ","sh":"ش","gh":"غ","zh":"ژ","ts":"ژ",
  "aa":"آ","ae":"ٲ","ii":"یٖ","uu":"وٗ","oe":"ۄ",
  // Intuitive one-key phonetic layer: m = meem, b = beh, n = noon, etc.
  "a":"ا","b":"ب","p":"پ","t":"ت","T":"ٹ","d":"د","D":"ڈ","j":"ج","c":"چ",
  "s":"س","z":"ز","k":"ک","g":"گ","l":"ل","m":"م","n":"ن","w":"و","v":"و",
  "r":"ر","y":"ی","h":"ہ","q":"ق","f":"ف","x":"خ","e":"ع","i":"ی","u":"و","o":"وٚ",
  // Shift layer covers retroflex, loanword and Kashmiri-specific characters.
  "A":"آ","E":"ء","R":"ڑ","Y":"ے","W":"ۄ","N":"ں","K":"خ","S":"ش","F":"ث",
  "H":"ح","G":"غ","J":"ض","L":"ط","V":"ظ","X":"ذ","Z":"ژ","C":"چھ","B":"بھ",
  "M":"مّ","Q":"ص","I":"ِ","U":"ٗ","O":"ٚ","P":"ٟ",
  "1":"۱","2":"۲","3":"۳","4":"۴","5":"۵","6":"۶","7":"۷","8":"۸","9":"۹","0":"۰",
  ";":"؛",",":"،","/":"؟","?":"؟",".":"۔",":":":",
  "!":"!","@":"@","#":"#","$":"$","%":"٪","^":"^","&":"&","*":"*","(":"(",")":")",
  "`":"ٲ","~":"ؠ","-":"-","_":"_","=":"=","+":"+","\\":"\\","|":"|",
  "[":"[","]":"]","{":"{","}":"}","'":"ٔ","\"":"ٕ","<":"<",">":">"
}
const PHONETIC_ALT_MAP = {
  "a":"ٲ","w":"ۄ","y":"ؠ","h":"ٕ","i":"ٟ","e":"ٚ","u":"ٗ","z":"ذ"
}
const PHONETIC_KEYS = Object.keys(PHONETIC_MAP_RAW).sort((a,b)=>b.length-a.length)
const PHONETIC_BUFFER_SIZE = 2
const KASHMIRI_KEYBOARD_GROUPS = {
  alphabet:[
    {label:"Basic letters",keys:["ب","پ","ت","د","ٹ","ڈ","ک","گ","ژ","چ","ج","س","ز","ش","ہ","م","ن","و","ر","ل","ی"]},
    {label:"Additional letters",keys:["ث","ح","خ","ذ","ڑ","ص","ض","ط","ظ","ع","غ","ف","ق"]},
    {label:"Special and carriers",keys:["ا","آ","ٲ","أ","إ","ء","ں","ۄ","ھ","ے","ؠ"]},
    {label:"Aspirated combinations",keys:["پھ","بھ","تھ","ٹھ","ژھ","چھ","کھ"]}
  ],
  vowels:[
    {label:"16 vowel forms",keys:[
      {value:"اَ",hint:"a"},{value:"آ",hint:"aa"},{value:"أ",hint:"ə"},{value:"ٲ",hint:"ə̄"},
      {value:"اِ",hint:"i"},{value:"ایٖ",hint:"ī"},{value:"إ",hint:"ɨ"},{value:"اٟ",hint:"ɨ̄"},
      {value:"اُ",hint:"u"},{value:"اوٗ",hint:"ū"},{value:"ایٚ",hint:"e"},{value:"ای",hint:"ē"},
      {value:"اوٚ",hint:"o"},{value:"او",hint:"ō"},{value:"اۄ",hint:"ɔ"},{value:"اۄا",hint:"ɔ̄"}
    ]},
    {label:"Combining marks",keys:[
      {value:"َ",display:"بَ",hint:"Fatha"},{value:"ُ",display:"بُ",hint:"Damma"},
      {value:"ِ",display:"بِ",hint:"Kasra"},{value:"ٔ",display:"بٔ",hint:"ə"},
      {value:"ٕ",display:"بٕ",hint:"ɨ"},{value:"ٖ",display:"بیٖ",hint:"ī"},
      {value:"ٗ",display:"بوٗ",hint:"ū"},{value:"ٚ",display:"بیٚ",hint:"e/o"},
      {value:"ٟ",display:"بٟ",hint:"ɨ̄"},{value:"ْ",display:"بْ",hint:"Jazm"},
      {value:"ّ",display:"بّ",hint:"Shadda"},{value:"ٰ",display:"بٰ",hint:"Sup. alef"}
    ]},
    {label:"Digits and punctuation",keys:["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹","،","؛","؟","۔","٪","٫","٬"]}
  ]
}
const IMG_JS = `(function(){if(window.__irs)return;window.__irs=true;
function clr(){document.querySelectorAll('.img-s').forEach(function(img){img.classList.remove('img-s');var w=img.parentElement;if(w&&w.classList.contains('img-wrap')){w.querySelectorAll('.irh').forEach(function(h){h.remove();});w.style.outline='none';}});}
function make(img){if(img.dataset.ir)return;img.dataset.ir='1';img.style.cursor='pointer';img.style.maxWidth='100%';img.style.display='inline-block';
img.addEventListener('click',function(e){e.stopPropagation();clr();img.classList.add('img-s');var w=img.parentElement;if(!w)return;w.style.outline='2px solid #2b579a';w.style.display='inline-block';w.style.position='relative';w.classList.add('img-wrap');
['se','sw','ne','nw'].forEach(function(c){var h=document.createElement('span');h.className='irh img-resize-handle';
h.style.cssText='position:absolute;width:10px;height:10px;background:#2b579a;border:2px solid #fff;border-radius:2px;z-index:99;cursor:nwse-resize;'+(c.includes('s')?'bottom:-5px;':'top:-5px;')+(c.includes('e')?'right:-5px;':'left:-5px;');
var sx,sw2,sh2;h.addEventListener('pointerdown',function(ev){ev.preventDefault();ev.stopPropagation();h.setPointerCapture(ev.pointerId);sx=ev.clientX;sw2=img.offsetWidth;sh2=img.offsetHeight;
function mv(mv){var dx=mv.clientX-sx;var nw=Math.max(30,sw2+(c.includes('e')?dx:-dx));img.style.width=nw+'px';img.style.height=(nw*(sh2/sw2))+'px';}
function up(){h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);}
h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);});w.appendChild(h);});});
}
document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.img-wrap'))clr();});
var ob=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(!n||n.nodeType!==1)return;if(n.tagName==='IMG')make(n);else if(n.querySelectorAll)n.querySelectorAll('img').forEach(make);});});});
window._irs=function(el){if(!el)return;el.querySelectorAll('img').forEach(make);ob.observe(el,{childList:true,subtree:true});};
})();`

function toRomanNumber(value){
  let number=Math.max(1,Math.floor(Number(value)||1)),result=""
  const map=[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]
  map.forEach(([amount,symbol])=>{while(number>=amount){result+=symbol;number-=amount}})
  return result
}
function toAlphaNumber(value){
  let number=Math.max(1,Math.floor(Number(value)||1)),result=""
  while(number){number--;result=String.fromCharCode(65+(number%26))+result;number=Math.floor(number/26)}
  return result
}
function formatPageLabel(number,total,format="number"){
  const formats={
    number:()=>String(number),
    page:()=>`Page ${number}`,
    pageOf:()=>`Page ${number} of ${total}`,
    roman:()=>toRomanNumber(number),
    romanLower:()=>toRomanNumber(number).toLowerCase(),
    alpha:()=>toAlphaNumber(number),
    alphaLower:()=>toAlphaNumber(number).toLowerCase(),
  }
  return (formats[format]||formats.number)()
}
function extractEditorPageText(root){
  if(!root)return ""
  const blockTags=new Set([
    "ADDRESS","ARTICLE","ASIDE","BLOCKQUOTE","DIV","FIGCAPTION","FIGURE",
    "H1","H2","H3","H4","H5","H6","HEADER","FOOTER","LI","P","PRE",
    "SECTION","TR",
  ])
  const ignoredSelector=[
    ".img-resize-handle",".irh",".shape-sel-indicator",
    "[data-object-caret]","[data-click-flow]","script","style",
  ].join(",")
  const walk=node=>{
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||""
    if(node.nodeType!==Node.ELEMENT_NODE)return ""
    const element=node
    if(element.matches?.(ignoredSelector))return ""
    if(element.classList?.contains("page-break-marker"))return "\n"
    if(element.tagName==="BR")return "\n"
    let text=Array.from(element.childNodes).map(walk).join("")
    if(element.tagName==="TD"||element.tagName==="TH")text+="\t"
    if(blockTags.has(element.tagName))text+="\n"
    return text
  }
  return Array.from(root.childNodes).map(walk).join("")
    .replace(/\r/g,"")
    // Remove source-code indentation around structural line breaks without
    // removing real spaces between adjacent formatted spans.
    .replace(/[ \t]*\n[ \t]*/g,"\n")
}
function calculateDocumentTextStats(pageTexts=[],logicalPageCount=null){
  const pages=pageTexts.map(value=>
    String(value||"")
      .replace(/[\u200B\uFEFF]/g,"")
      .replace(/\u00A0/g," ")
  )
  const countWords=value=>{
    if(!value.trim())return 0
    if(typeof Intl!=="undefined"&&Intl.Segmenter){
      const segmenter=new Intl.Segmenter(undefined,{granularity:"word"})
      return Array.from(segmenter.segment(value)).filter(segment=>segment.isWordLike).length
    }
    return (value.match(/[\p{L}\p{M}\p{N}]+(?:['’\-\u2010][\p{L}\p{M}\p{N}]+)*/gu)||[]).length
  }
  return {
    // The React page model is authoritative. DOM refs can temporarily lag
    // during pagination, page deletion, loading, or a newly inserted blank
    // page, which previously made Review → Word Count report the wrong total.
    pages:Math.max(1,Math.floor(Number(logicalPageCount)||pages.length)),
    words:pages.reduce((total,text)=>total+countWords(text),0),
    charactersWithSpaces:pages.reduce((total,text)=>
      total+text.replace(/[\r\n\t]/g,"").length,0),
    charactersWithoutSpaces:pages.reduce((total,text)=>
      total+text.replace(/\s/g,"").length,0),
    paragraphs:pages.reduce((total,text)=>
      total+text.split(/\r?\n/).filter(line=>line.trim().length>0).length,0),
  }
}
function doPrintPopup(pagesRef, fontFamily, orientation, headerText="", footerText="", pageNumber=false, pageBorderOptions=null, fontSize=14, lineSpacing="1.8",hfOptions={},themeConfig=DOCUMENT_THEMES.Office,printPageColor=null,watermarkConfig=null) {
  const printTheme=themeConfig||DOCUMENT_THEMES.Office
  const printedBackground=printPageColor||printTheme.page||"#ffffff"
  const printWatermark=watermarkConfig?.type==="text"&&String(watermarkConfig.text||"").trim()
    ?watermarkConfig
    :null
  const escapePrintHTML=value=>String(value??"").replace(/[&<>"]/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;",
  }[char]))
  const borderConfig=typeof pageBorderOptions==="object"&&pageBorderOptions
    ?pageBorderOptions
    :{setting:pageBorderOptions?"box":"none",style:"double",width:3,color:"#2b579a",
      sides:{top:true,right:true,bottom:true,left:true}}
  const themeVariables=[
    `--theme-text:${printTheme.text}`,
    `--theme-muted:${printTheme.muted}`,
    `--theme-accent1:${printTheme.accent1}`,
    `--theme-accent2:${printTheme.accent2}`,
    `--theme-accent3:${printTheme.accent3}`,
    `--theme-heading-font:${printTheme.headingFont}`,
    `--theme-body-font:${printTheme.bodyFont}`,
  ].join(";")
  const pagesHTML = pagesRef.current.filter(Boolean).map((pg,i,arr)=>{
    const clone = pg.cloneNode(true)
    clone.querySelectorAll(".img-resize-handle,.irh").forEach(el=>el.remove())
    clone.querySelectorAll(".img-wrap").forEach(el=>{el.style.outline="none"})
    const pb = i<arr.length-1?"page-break-after:always;break-after:page;":""
    const borderVisible=borderConfig.setting!=="none"&&borderConfig.style!=="none"
    const sides=borderConfig.sides||{top:true,right:true,bottom:true,left:true}
    const borderValue=`${Number(borderConfig.width)||1}pt ${borderConfig.style||"solid"} ${borderConfig.color||"#2b579a"}`
    const bdr=borderVisible
      ?`${sides.top!==false?`border-top:${borderValue};`:""}${sides.right!==false?`border-right:${borderValue};`:""}${sides.bottom!==false?`border-bottom:${borderValue};`:""}${sides.left!==false?`border-left:${borderValue};`:""}padding:8mm;${borderConfig.setting==="shadow"?"box-shadow:5px 5px 0 rgba(0,0,0,.35);":""}`
      :""
    const pageAtTop=pageNumber&&String(hfOptions.pageNumberPosition||"bottom-right").startsWith("top")
    const pageAtBottom=pageNumber&&!pageAtTop
    const pageAlign=String(hfOptions.pageNumberPosition||"bottom-right").split("-").pop()
    const pageLabel=formatPageLabel((hfOptions.pageNumberStart||1)+i,arr.length,hfOptions.pageNumberFormat||"number")
    const headerBits=[
      headerText?`<span style="flex:1;text-align:${hfOptions.headerAlign||"center"}">${headerText}</span>`:"",
      pageAtTop?`<span style="position:absolute;${pageAlign==="left"?"left:0":pageAlign==="right"?"right:0":"left:50%;transform:translateX(-50%)"}">${pageLabel}</span>`:"",
    ].join("")
    const footerBits=[
      footerText?`<span style="flex:1;text-align:${hfOptions.footerAlign||"left"}">${footerText}</span>`:"",
      pageAtBottom?`<span style="position:absolute;${pageAlign==="left"?"left:0":pageAlign==="right"?"right:0":"left:50%;transform:translateX(-50%)"}">${pageLabel}</span>`:"",
    ].join("")
    const hdr=(headerText||pageAtTop)?`<div style="position:relative;display:flex;border-bottom:1px solid ${printTheme.accent1};padding-bottom:6px;margin-bottom:10px;font-size:11pt;color:${printTheme.muted};">${headerBits}</div>`:""
    const ftr=(footerText||pageAtBottom)?`<div style="position:relative;display:flex;border-top:1px solid ${printTheme.accent1};padding-top:6px;margin-top:10px;font-size:10pt;color:${printTheme.muted};">${footerBits}</div>`:""
    const watermarkHTML=printWatermark
      ?`<div class="print-watermark"><span style="font-family:${escapePrintHTML(String(printWatermark.font||"Arial").replace(/[;<>]/g,""))};font-size:${Math.max(24,Math.min(120,Number(printWatermark.size)||56))}pt;color:${/^#[0-9a-f]{6}$/i.test(printWatermark.color)?printWatermark.color:"#b8b8b8"};opacity:${Math.max(.05,Math.min(.8,Number(printWatermark.opacity)||.28))};transform:${printWatermark.layout==="horizontal"?"none":"rotate(-45deg)"}">${escapePrintHTML(printWatermark.text)}</span></div>`
      :""
    return `<div class="pp" data-document-theme="print" style="${themeVariables};${pb}${bdr}background:${printedBackground};color:var(--theme-text);">${hdr}${watermarkHTML}${clone.innerHTML}${ftr}</div>`
  }).join("\n")
  const pw=orientation==="landscape"?"297mm":"210mm", ph=orientation==="landscape"?"210mm":"297mm"
  const html=`<!DOCTYPE html><html dir="rtl" lang="ur"><head><meta charset="utf-8"><title>&#8203;</title>
<style>*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@counter-style kashur-urdu-digits{system:numeric;symbols:"۰" "۱" "۲" "۳" "۴" "۵" "۶" "۷" "۸" "۹";suffix:". ";}@counter-style decimal-paren{system:numeric;symbols:"0" "1" "2" "3" "4" "5" "6" "7" "8" "9";suffix:") ";}@counter-style decimal-brackets{system:numeric;symbols:"0" "1" "2" "3" "4" "5" "6" "7" "8" "9";prefix:"(";suffix:") ";}@counter-style lower-alpha-paren{system:alphabetic;symbols:a b c d e f g h i j k l m n o p q r s t u v w x y z;suffix:") ";}@page{size:${pw} ${ph};margin:0;}html,body{width:${pw};margin:0!important;padding:0!important;}body{font-family:${printTheme.bodyFont||fontFamily||"Arial,sans-serif"};font-size:${fontSize||14}pt;line-height:${lineSpacing||1.8};direction:rtl;text-align:right;color:${printTheme.text};background:#fff;}.pp{width:${pw};height:${ph};min-height:${ph};padding:20mm!important;position:relative;overflow:hidden;page-break-inside:avoid;break-inside:avoid;}.print-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;user-select:none;z-index:10;overflow:hidden;}.print-watermark span{white-space:nowrap;font-weight:600;letter-spacing:2px;}img{max-width:100%;height:auto;}table{border-collapse:collapse;width:100%;direction:rtl;}td,th{border:1px solid #aaa;padding:6px 8px;}th{background:var(--theme-accent1);color:#fff;}a{color:var(--theme-accent1);}h1{font-size:22pt;color:var(--theme-accent1);font-family:var(--theme-heading-font);}h2{font-size:18pt;color:var(--theme-accent1);font-family:var(--theme-heading-font);}h3{font-size:14pt;color:var(--theme-accent2);font-family:var(--theme-heading-font);}ul,ol{padding-inline-start:0;padding-inline-end:32px;direction:rtl;list-style-position:outside;margin-block:0;}li{padding-inline-start:4px;margin:0;}li::marker{color:var(--theme-accent1);}[data-multilevel]{counter-reset:word-level;}[data-multilevel] ol{counter-reset:word-level;}[data-multilevel]:not([data-multilevel="mixed"]) li{display:block;counter-increment:word-level;}[data-multilevel]:not([data-multilevel="mixed"]) li::before{display:inline-block;min-width:46px;margin-inline-end:6px;text-align:end;}[data-multilevel="outline"] li::before,[data-multilevel="headings"] li::before{content:counters(word-level,".") ".";}[data-multilevel="paren"]>li::before{content:counter(word-level) ")";}[data-multilevel="paren"] ol>li::before{content:counter(word-level,lower-alpha) ")";}[data-multilevel="paren"] ol ol>li::before{content:counter(word-level,lower-roman) ")";}[data-multilevel="article"]>li::before{content:"Article " counter(word-level,upper-roman);}[data-multilevel="article"] ol>li::before{content:"Section 1." counter(word-level,decimal-leading-zero);}[data-multilevel="article"] ol ol>li::before{content:"(" counter(word-level,lower-alpha) ")";}[data-multilevel="chapter"]>li::before{content:"Chapter " counter(word-level);}[data-multilevel="chapter"] ol>li::before{content:"Section " counters(word-level,".");}[data-multilevel="legal"]>li::before{content:counter(word-level) ".";}[data-multilevel="legal"] ol>li::before{content:counter(word-level,upper-alpha) ".";}[data-multilevel="mixed"]{list-style-type:"◆  ";}[data-multilevel="mixed"] ul{list-style-type:"➤  ";}[data-multilevel="mixed"] ul ul{list-style-type:square;}blockquote{border-right:4px solid var(--theme-accent1);padding-right:12px;color:var(--theme-muted);}pre{background:color-mix(in srgb,var(--theme-accent1) 8%,white);padding:10px;font-family:monospace;direction:ltr;text-align:left;}.page-break-marker{page-break-after:always;break-after:page;height:0;border:none!important;}.page-break-marker span{display:none!important;}#pb{position:fixed;bottom:0;left:0;right:0;background:#2b579a;color:#fff;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;font-size:14px;z-index:9999;}#pb button{background:#fff;color:#2b579a;border:none;padding:8px 24px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;}@media print{#pb{display:none!important;}.preview-pages{padding-bottom:0!important;}html,body{margin:0!important;padding:0!important;}.pp{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head>
<style>html,body{background:${printedBackground}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{background:${printedBackground};}.pp{background:${printedBackground}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>
<body><div id="pb"><span>📄 Print Preview — page colour included</span><div style="display:flex;gap:8px;"><button onclick="window.print()">🖨 Print / Save PDF</button><button onclick="window.close()" style="background:#f44;color:#fff;">✕ Close</button></div></div>
<div class="preview-pages" style="padding-bottom:60px;">${pagesHTML}</div></body></html>`
  const blob=new Blob([html],{type:"text/html;charset=utf-8"})
  const url=URL.createObjectURL(blob)
  const win=window.open(url,"_blank")
  if(!win){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";document.body.appendChild(a);a.click();document.body.removeChild(a)}
  setTimeout(()=>URL.revokeObjectURL(url),30000)
}

function xCmd(cmd,val=null){try{return document.execCommand(cmd,false,val)}catch(e){console.warn("execCommand:",cmd,e);return false}}
// Word-accurate select/input style helper
const ss=w=>({background:"#fff",border:`1px solid ${BORDER}`,borderRadius:2,padding:"2px 5px",fontSize:12,color:"#1a1a1a",cursor:"pointer",height:24,width:w,outline:"none"})
const fbtnSt={border:`1px solid ${BORDER}`,borderRadius:2,padding:"2px 8px",fontSize:12,cursor:"pointer",background:"#fff",color:"#1a1a1a"}

function AppModal({type="info",title,message,onClose,onConfirm,onDiscard,inputDefault="",dark=false}){
  const mbg=dark?"#1f2937":"#ffffff",mtxt=dark?"#f3f4f6":"#1f2937"
  const [val,setVal]=useState(inputDefault),inputRef=useRef(null)
  useEffect(()=>{if(type==="prompt")setTimeout(()=>inputRef.current?.focus(),50)},[type])
  return(<div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99999}}>
    <div style={{background:mbg,borderRadius:12,padding:28,width:380,boxShadow:"0 16px 48px rgba(0,0,0,.25)"}}>
      <div style={{fontSize:22,marginBottom:10}}>{type==="danger"?"🗑️":type==="warn"||type==="saveconfirm"?"⚠️":type==="prompt"?"✏️":"ℹ️"}</div>
      <h3 style={{fontSize:17,fontWeight:600,color:mtxt,marginBottom:8}}>{title}</h3>
      <p style={{fontSize:14,color:"#4b5563",marginBottom:type==="prompt"?12:20,lineHeight:1.6}} dangerouslySetInnerHTML={{__html:message}}/>
      {type==="prompt"&&<input ref={inputRef} value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onConfirm?.(val)}} style={{width:"100%",padding:"8px 12px",border:`1px solid ${BORDER}`,borderRadius:6,fontSize:14,marginBottom:16,boxSizing:"border-box",outline:"none"}}/>}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        {(type==="confirm"||type==="danger"||type==="prompt"||type==="saveconfirm")&&<button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${BORDER}`,borderRadius:6,background:"#fff",cursor:"pointer",fontSize:13}}>Cancel</button>}
        {type==="saveconfirm"&&<button onClick={()=>onDiscard?.()} style={{padding:"7px 18px",border:`1px solid ${BORDER}`,borderRadius:6,background:"#fff",color:"#b42318",cursor:"pointer",fontSize:13}}>Don&apos;t Save</button>}
        <button onClick={()=>onConfirm?.(type==="prompt"?val:true)} style={{padding:"7px 18px",border:"none",borderRadius:6,background:type==="danger"?"#c0392b":WORD_BLUE,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>
          {type==="danger"?"Delete":type==="prompt"?"OK":type==="saveconfirm"?"Save":type==="confirm"?"Yes":"OK"}
        </button>
      </div>
    </div>
  </div>)
}

function Toast({msg,type="success"}){
  return(<div style={{position:"fixed",bottom:24,right:24,zIndex:99999,background:type==="error"?"#c0392b":"#1a7f4e",color:"#fff",padding:"12px 20px",borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,.2)",fontSize:14,fontWeight:500,maxWidth:360,animation:"slideUp .25s ease"}}>
    {type==="error"?"⚠️":"✅"} {msg}
    <style>{`@keyframes slideUp{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}`}</style>
  </div>)
}

const RBtn=forwardRef(function RBtn({children,onClick,onMouseDown,active=false,title="",style={},vertical=false,disabled=false},ref){
  const [hov,setHov]=useState(false)
  const isOn = active||hov
  return(<button ref={ref} title={title} disabled={disabled}
    onMouseDown={e=>{e.preventDefault();if(!disabled&&onMouseDown)onMouseDown(e)}}
    onClick={onClick}
    onMouseEnter={()=>{if(!disabled)setHov(true)}}
    onMouseLeave={()=>setHov(false)}
    style={{
      background: active ? BTN_ACTIVE_BG : hov&&!disabled ? BTN_HOVER_BG : "transparent",
      border: active ? `1px solid ${BTN_ACTIVE_BDR}` : hov&&!disabled ? `1px solid #b8d0f0` : "1px solid transparent",
      borderRadius: 3,
      padding: vertical ? "6px 6px 4px" : "2px 6px",
      fontSize: 12,
      cursor: disabled ? "default" : "pointer",
      color: "#1a1a1a",
      display: "flex",
      flexDirection: vertical ? "column" : "row",
      alignItems: "center",
      justifyContent: "center",
      gap: vertical ? 2 : 3,
      minWidth: vertical ? 46 : 26,
      height: vertical ? 56 : 26,
      userSelect: "none",
      transition: "background .08s, border .08s",
      flexShrink: 0,
      fontFamily: "Segoe UI, sans-serif",
      whiteSpace: "nowrap",
      opacity: disabled ? .42 : 1,
      ...style
    }}>
    {children}
  </button>)
})

function RGroup({children,label}){
  return(
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"stretch",
      padding:"4px 4px 0", borderRight:"1px solid #d8d8d8",
      flexShrink:0, minWidth:0, position:"relative",
      height:"100%", boxSizing:"border-box",
    }}>
      <div style={{
        display:"flex", alignItems:"center", gap:2, flexWrap:"nowrap",
        justifyContent:"flex-start", flex:1, padding:"2px 2px 0",
        overflowX:"visible",
      }}>{children}</div>
      {label&&<div style={{
        fontSize:10, color:GROUP_LABEL_C, fontWeight:400,
        textAlign:"center", paddingBottom:4, paddingTop:2, whiteSpace:"nowrap",
        letterSpacing:0.1, lineHeight:1, userSelect:"none",
        fontFamily:"Segoe UI, sans-serif", flexShrink:0,
      }}>{label}</div>}
    </div>
  )
}

function Modal({title,children,onClose}){
  return(<div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
    <div style={{background:"#fff",borderRadius:10,width:380,padding:24,boxShadow:"0 8px 32px rgba(0,0,0,.25)",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <span style={{fontWeight:600,fontSize:15,color:WORD_BLUE}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#888"}}>×</button>
      </div>
      {children}
    </div>
  </div>)
}
function TableDialog({onInsert,onClose}){
  const [rows,setRows]=useState(3),[cols,setCols]=useState(3),[hdr,setHdr]=useState(true),[bdr,setBdr]=useState(true)
  return(<Modal title="جدول داخل کریں" onClose={onClose}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
      {[["Rows",rows,setRows,100],["Columns",cols,setCols,20]].map(([l,v,s,m])=>(
        <label key={l} style={{fontSize:13}}>{l}<input type="number" min={1} max={m} value={v} onChange={e=>s(Math.max(1,parseInt(e.target.value)||1))} style={{display:"block",width:"100%",marginTop:4,padding:"5px 8px",border:`1px solid ${BORDER}`,borderRadius:3,fontSize:13}}/></label>
      ))}
    </div>
    <div style={{display:"flex",gap:20,marginBottom:14}}>
      {[[hdr,setHdr,"Header row"],[bdr,setBdr,"Borders"]].map(([v,s,l])=>(
        <label key={l} style={{fontSize:13,display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><input type="checkbox" checked={v} onChange={e=>s(e.target.checked)}/> {l}</label>
      ))}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:2,marginBottom:16,padding:8,background:"#f7f7f7",borderRadius:4}}>
      {Array.from({length:Math.min(rows,6)}).map((_,r)=>(
        <div key={r} style={{display:"flex",gap:2}}>
          {Array.from({length:Math.min(cols,8)}).map((_,c)=>(
            <div key={c} style={{width:22,height:14,border:`1px solid ${r===0&&hdr?WORD_BLUE:"#bbb"}`,background:r===0&&hdr?"#dce6f5":"#fff"}}/>
          ))}
        </div>
      ))}
    </div>
    <button onClick={()=>{onInsert(rows,cols,hdr,bdr);onClose()}} style={{background:WORD_BLUE,color:"#fff",border:"none",borderRadius:4,padding:"8px 0",cursor:"pointer",fontSize:13,fontWeight:500,width:"100%"}}>Insert Table</button>
  </Modal>)
}

function ImageDialog({onInsert,onClose,onEditImage}){
  const [src,setSrc]=useState(""),[width,setWidth]=useState(300),[align,setAlign]=useState("center"),fRef=useRef(null)
  return(<Modal title="تصویر داخل کریں" onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <label style={{fontSize:13}}>Image URL<input value={src} onChange={e=>setSrc(e.target.value)} placeholder="https://..." style={{display:"block",width:"100%",marginTop:4,padding:"5px 8px",border:`1px solid ${BORDER}`,borderRadius:3,fontSize:13,boxSizing:"border-box"}}/></label>
      <button onMouseDown={e=>e.preventDefault()} onClick={()=>fRef.current?.click()} style={{border:`1px solid ${BORDER}`,borderRadius:3,padding:7,cursor:"pointer",fontSize:13,background:"#f7f7f7"}}>📁 Browse from computer</button>
      <input ref={fRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setSrc(ev.target.result);r.readAsDataURL(f)}}/>
      {src&&<img src={src} alt="" style={{maxWidth:"100%",maxHeight:120,borderRadius:4,objectFit:"contain",border:`1px solid ${BORDER}`}}/>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <label style={{fontSize:13}}>Width (px)<input type="number" min={30} max={1200} value={width} onChange={e=>setWidth(parseInt(e.target.value)||300)} style={{display:"block",width:"100%",marginTop:4,padding:"5px 8px",border:`1px solid ${BORDER}`,borderRadius:3}}/></label>
        <label style={{fontSize:13}}>Alignment<select value={align} onChange={e=>setAlign(e.target.value)} style={{display:"block",width:"100%",marginTop:4,padding:"5px 8px",border:`1px solid ${BORDER}`,borderRadius:3}}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      </div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:14}}>
      <button disabled={!src} onMouseDown={e=>e.preventDefault()} onClick={()=>src&&onEditImage?.(src,width,align)}
        style={{flex:1,background:"#fff",color:WORD_BLUE,border:`1px solid ${WORD_BLUE}`,borderRadius:4,padding:"8px 0",cursor:src?"pointer":"default",fontSize:13,fontWeight:500,opacity:src?1:.5}}>Edit / Crop…</button>
      <button onMouseDown={e=>e.preventDefault()} onClick={()=>{if(src){onInsert(src,width,align);onClose()}}}
        style={{flex:1,background:WORD_BLUE,color:"#fff",border:"none",borderRadius:4,padding:"8px 0",cursor:"pointer",fontSize:13,fontWeight:500}}>Insert Image</button>
    </div>
  </Modal>)
}

function LinkDialog({selectedText="",onInsert,onClose}){
  const [text,setText]=useState(selectedText)
  const [url,setUrl]=useState("https://")
  const valid=url.trim()&&url.trim()!=="https://"
  return <Modal title="Insert Link" onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:11}}>
      <label style={{fontSize:12,color:"#555"}}>Text to display
        <input value={text} onChange={event=>setText(event.target.value)} placeholder="Link text"
          style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:4,padding:"7px 9px",border:`1px solid ${BORDER}`,borderRadius:4}}/>
      </label>
      <label style={{fontSize:12,color:"#555"}}>Address
        <input autoFocus value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://example.com"
          onKeyDown={event=>{if(event.key==="Enter"&&valid)onInsert(text,url)}}
          style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:4,padding:"7px 9px",border:`1px solid ${BORDER}`,borderRadius:4,direction:"ltr"}}/>
      </label>
      <div style={{fontSize:10,color:"#777"}}>Tip: Ctrl + click a link in the document to open it.</div>
      <button disabled={!valid} onClick={()=>valid&&onInsert(text,url)}
        style={{padding:8,border:"none",borderRadius:5,background:valid?WORD_BLUE:"#bbb",color:"#fff",fontWeight:600,cursor:valid?"pointer":"default"}}>Insert Link</button>
    </div>
  </Modal>
}

function OpenDialog({onOpen,onClose,token}){
  const [docs,setDocs]=useState([]),[loading,setLoading]=useState(true),[opening,setOpening]=useState(null)
  const authH=token?{Authorization:`Bearer ${token}`}:{}
  useEffect(()=>{fetch(`${API_BASE}/documents`,{headers:{...authH,"Content-Type":"application/json"}}).then(r=>r.json()).then(d=>{setDocs(d);setLoading(false)}).catch(()=>setLoading(false))},[])
  async function handleOpen(docMeta){
    setOpening(docMeta.id)
    try{const full=await fetch(`${API_BASE}/documents/${docMeta.id}`,{headers:{...authH,"Content-Type":"application/json"}}).then(r=>r.json());onOpen(full)}
    catch(e){console.error("Failed:",e);setOpening(null)}
  }
  return(<Modal title="دستاویز کُھولیو" onClose={onClose}>
    {loading?<div style={{textAlign:"center",padding:20,color:"#888"}}>Loading...</div>
    :docs.length===0?<div style={{textAlign:"center",padding:20,color:"#aaa"}}>No saved documents yet.</div>
    :<div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:340,overflowY:"auto"}}>
      {docs.map(d=>(<button key={d.id} onClick={()=>handleOpen(d)} disabled={opening===d.id}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",border:`1px solid ${BORDER}`,borderRadius:6,background:"#fff",cursor:"pointer",opacity:opening===d.id?.6:1}}
        onMouseEnter={e=>e.currentTarget.style.background="#e8f0fa"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
        <span style={{fontSize:13,fontWeight:500}}>{d.title}</span>
        <span style={{fontSize:11,color:"#aaa"}}>{opening===d.id?"Loading…":new Date(d.updatedAt).toLocaleDateString()}</span>
      </button>))}
    </div>}
  </Modal>)
}

function ShareDialog({title,url,onClose,onStop,dark=false}){
  const [copied,setCopied]=useState(false)
  const bg=dark?"#1f2937":"#fff",text=dark?"#f3f4f6":"#1f2937"
  const shareText=`📄 ${title}\n${url}`
  const whatsapp=`https://wa.me/?text=${encodeURIComponent(shareText)}`
  const email=`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`I am sharing this Kashur Editor document with you:\n\n${title}\n${url}`)}`
  async function copyLink(){
    try{
      await navigator.clipboard.writeText(url)
    }catch{
      const area=document.createElement("textarea")
      area.value=url;area.style.position="fixed";area.style.opacity="0"
      document.body.appendChild(area);area.select();document.execCommand("copy");area.remove()
    }
    setCopied(true);setTimeout(()=>setCopied(false),1800)
  }
  return(
    <div onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}
      style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(0,0,0,.5)",
        display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:460,maxWidth:"100%",background:bg,color:text,borderRadius:12,
        boxShadow:"0 18px 55px rgba(0,0,0,.3)",overflow:"hidden"}}>
        <div style={{background:WORD_BLUE,color:"#fff",padding:"14px 18px",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontSize:16,fontWeight:700}}>Share Document</div>
            <div style={{fontSize:11,opacity:.8,marginTop:2}}>{title}</div></div>
          <button onClick={onClose} aria-label="Close share window"
            style={{border:"none",background:"transparent",color:"#fff",fontSize:21,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:18}}>
          <div style={{fontSize:12,color:dark?"#cbd5e1":"#667085",marginBottom:7}}>
            Anyone with this link can view the document.
          </div>
          <div style={{display:"flex",gap:7}}>
            <input readOnly value={url} onFocus={event=>event.currentTarget.select()}
              aria-label="Public document link"
              style={{flex:1,minWidth:0,padding:"8px 10px",border:`1px solid ${dark?"#4b5563":BORDER}`,
                borderRadius:5,background:dark?"#111827":"#f8fafc",color:text,fontSize:11}}/>
            <button onClick={copyLink}
              style={{border:"none",borderRadius:5,background:copied?"#16803b":WORD_BLUE,
                color:"#fff",padding:"0 14px",cursor:"pointer",fontWeight:600}}>
              {copied?"Copied ✓":"Copy"}
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:18}}>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"11px 12px",borderRadius:7,background:"#25D366",color:"#fff",
                textDecoration:"none",fontSize:13,fontWeight:700}}>
              <span style={{fontSize:18}}>◉</span> WhatsApp
            </a>
            <a href={email}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"11px 12px",borderRadius:7,background:"#ea4335",color:"#fff",
                textDecoration:"none",fontSize:13,fontWeight:700}}>
              <span style={{fontSize:17}}>✉</span> Email
            </a>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            marginTop:18,paddingTop:13,borderTop:`1px solid ${dark?"#374151":"#e5e7eb"}`}}>
            <button onClick={onStop}
              style={{border:"none",background:"transparent",color:"#c0392b",cursor:"pointer",
                padding:"5px 0",fontSize:12}}>Stop sharing</button>
            <button onClick={onClose}
              style={{border:`1px solid ${dark?"#4b5563":BORDER}`,borderRadius:5,
                background:dark?"#374151":"#fff",color:text,padding:"7px 18px",cursor:"pointer"}}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FMenuItem({item,onClick}){
  const [hov,setHov]=useState(false)
  return(<button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:hov?"rgba(255,255,255,.13)":"transparent",border:"none",color:"#fff",padding:"8px 16px",cursor:"pointer",fontSize:13,justifyContent:"space-between"}}>
    <span style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:14,width:20,textAlign:"center"}}>{item.icon}</span><span>{item.label}</span></span>
    {item.shortcut&&<span style={{fontSize:11,opacity:.55}}>{item.shortcut}</span>}
  </button>)
}

function HomeRibbon({exec,fontSize,setFontSize,fontFamily,setFontFamily,applyFontSize,applyFontFamily,applyParagraphAlignment,applyParagraphIndent,applyParagraphLineSpacing,applyParagraphStyle,insertList,insertMultilevelList,removeList,saveSelection,customUndo,customRedo,copySelection,cutSelection,pasteClipboard,canUndo,canRedo,clearAllFormatting,showParagraphMarks,setShowParagraphMarks}){
  const [listOpen,setListOpen]=useState(false),[listPos,setListPos]=useState({top:0,left:0})
  const [listKind,setListKind]=useState("ul")
  const [toolbarFontSize,setToolbarFontSize]=useState(fontSize)
  const [toolbarFontFamily,setToolbarFontFamily]=useState(fontFamily)
  const [activeListTag,setActiveListTag]=useState(null)
  const [activeListStyle,setActiveListStyle]=useState(null)
  const [activeMultilevel,setActiveMultilevel]=useState(null)
  const [activeAlignment,setActiveAlignment]=useState("right")
  const [activeLineSpacing,setActiveLineSpacing]=useState("1.5")
  const [activeParagraphStyle,setActiveParagraphStyle]=useState("p")
  const [activeFontColor,setActiveFontColor]=useState("#000000")
  const [activeHighlightColor,setActiveHighlightColor]=useState("#ffff00")
  const lBtnRef=useRef(null),nBtnRef=useRef(null),mBtnRef=useRef(null),lMenuRef=useRef(null)
  useEffect(()=>setToolbarFontSize(fontSize),[fontSize])
  useEffect(()=>setToolbarFontFamily(fontFamily),[fontFamily])
  const cssColorToHex=useCallback((value,fallback)=>{
    if(!value||value==="transparent"||value==="rgba(0, 0, 0, 0)")return fallback
    if(/^#[0-9a-f]{6}$/i.test(value))return value.toLowerCase()
    const match=value.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i)
    return match?`#${match.slice(1,4).map(part=>Number(part).toString(16).padStart(2,"0")).join("")}`:fallback
  },[])
  useEffect(()=>{
    // Keep the ribbon values synchronized with the text/caret under the live
    // selection. Moving to another line therefore shows that line's actual
    // inherited/default size instead of leaving the last toolbar choice shown.
    function syncFontControls(){
      const selection=window.getSelection()
      if(!selection||selection.rangeCount===0||!selection.anchorNode)return
      const element=selection.anchorNode.nodeType===1
        ?selection.anchorNode
        :selection.anchorNode.parentElement
      const editor=element?.closest?.('[contenteditable="true"]')
      if(!editor)return
      const activeList=element?.closest?.("ul,ol")
      setActiveListTag(activeList&&editor.contains(activeList)?activeList.tagName.toLowerCase():null)
      if(activeList&&editor.contains(activeList)){
        setActiveMultilevel(activeList.closest("[data-multilevel]")?.getAttribute("data-multilevel")||null)
        setActiveListStyle(
          activeList.getAttribute("data-custom-marker")
          ||(activeList.hasAttribute("data-urdu-list")?"custom-urdu":activeList.style.listStyleType)
          ||getComputedStyle(activeList).listStyleType
        )
      }else{setActiveListStyle(null);setActiveMultilevel(null)}
      const paragraph=element?.closest?.("li,p,div,h1,h2,h3,h4,h5,h6,blockquote,pre")
      if(paragraph&&editor.contains(paragraph)){
        const paragraphStyle=getComputedStyle(paragraph)
        setActiveAlignment(paragraphStyle.textAlign==="start"
          ?(paragraphStyle.direction==="rtl"?"right":"left")
          :paragraphStyle.textAlign)
        const spacing=Number.parseFloat(paragraphStyle.lineHeight)
        const size=Number.parseFloat(paragraphStyle.fontSize)
        if(Number.isFinite(spacing)&&Number.isFinite(size)&&size>0){
          const ratio=(spacing/size)
          const closest=["1","1.15","1.5","2","2.5","3"]
            .reduce((best,value)=>Math.abs(Number(value)-ratio)<Math.abs(Number(best)-ratio)?value:best,"1.5")
          setActiveLineSpacing(closest)
        }else if(paragraph.style.lineHeight){
          setActiveLineSpacing(paragraph.style.lineHeight)
        }
        const tag=paragraph.tagName.toLowerCase()
        const storedStyle=paragraph.getAttribute("data-word-style")
        const knownStyles=["p","noSpacing","subtitle","h1","h2","h3","h4","numbered","blockquote"]
        setActiveParagraphStyle(paragraph.hasAttribute("data-numbered-heading")
            ?"numbered"
            :knownStyles.includes(storedStyle)
              ?storedStyle
              :(["h1","h2","h3","h4","blockquote"].includes(tag)?tag:"p"))
      }
      let block=element
      while(block&&block!==editor&&block.parentElement!==editor)block=block.parentElement
      const emptyLine=block&&block!==editor
        &&!(block.textContent||"").replace(/\u200B/g,"").trim()
      // An empty line has no text formatting of its own. Show the editor's
      // real default values instead of a stale span inherited from the line
      // where Enter was pressed.
      const style=getComputedStyle(emptyLine?editor:element)
      const size=Math.round(parseFloat(style.fontSize))
      if(Number.isFinite(size))setToolbarFontSize(size)
      const computedFamilies=style.fontFamily.split(",")
        .map(name=>name.replace(/['"]/g,"").trim().toLowerCase())
      const family=Kashur_FONTS.find(font=>computedFamilies.includes(primaryFontName(font.value)))
      if(family)setToolbarFontFamily(family.value)
      setActiveFontColor(cssColorToHex(style.color,"#000000"))
      // Background is inherited differently from text colour. Walk upward to
      // the first real inline highlight, stopping at the editable page.
      let highlighted=emptyLine?null:element
      let highlight="transparent"
      while(highlighted&&highlighted!==editor){
        const candidate=getComputedStyle(highlighted).backgroundColor
        if(candidate&&candidate!=="transparent"&&candidate!=="rgba(0, 0, 0, 0)"){
          highlight=candidate;break
        }
        highlighted=highlighted.parentElement
      }
      setActiveHighlightColor(cssColorToHex(highlight,"#ffff00"))
    }
    document.addEventListener("selectionchange",syncFontControls)
    return()=>document.removeEventListener("selectionchange",syncFontControls)
  },[cssColorToHex])
  useEffect(()=>{const fn=e=>{
    if(listOpen&&lMenuRef.current&&!lMenuRef.current.contains(e.target)
      &&lBtnRef.current&&!lBtnRef.current.contains(e.target)
      &&nBtnRef.current&&!nBtnRef.current.contains(e.target)
      &&mBtnRef.current&&!mBtnRef.current.contains(e.target))setListOpen(false)
  };document.addEventListener("mousedown",fn);return()=>document.removeEventListener("mousedown",fn)},[listOpen])
  useEffect(()=>{if(!listOpen)return;const fn=()=>setListOpen(false);window.addEventListener("scroll",fn,true);return()=>window.removeEventListener("scroll",fn,true)},[listOpen])
  function toggleList(e,kind,ref){
    e.preventDefault();e.stopPropagation();saveSelection()
    if(listOpen&&listKind===kind){setListOpen(false);return}
    setListKind(kind)
    if(ref.current){
      const r=ref.current.getBoundingClientRect()
      const menuWidth=kind==="ul"?420:kind==="ol"?430:500
      setListPos({top:r.bottom+4,left:Math.max(8,Math.min(r.left,window.innerWidth-menuWidth-8))})
    }
    setListOpen(true)
  }

  const bulletTypes = LIST_TYPES.filter(l=>l.tag==="ul")
  const numberTypes = LIST_TYPES.filter(l=>l.tag==="ol")
  const uniqueFonts=uniqueFontList(Kashur_FONTS)
  const activeFont=uniqueFonts.find(font=>font.value===toolbarFontFamily)
    ||(toolbarFontFamily?{
      label:toolbarFontFamily.split(",")[0].replace(/['"]/g,"").trim(),
      value:toolbarFontFamily,
    }:null)
  const orderedFonts=activeFont
    ?uniqueFontList([activeFont,...uniqueFonts])
    :uniqueFonts
  const sectionBar=label=><div style={{height:27,display:"flex",alignItems:"center",
    padding:"0 10px",margin:"7px 0 6px",background:"#e7e7e7",color:"#252525",
    fontSize:12,fontWeight:600}}>{label}</div>
  const numberMarkers=lt=>lt.ls==="decimal-paren"?["1)","2)","3)"]:
    lt.ls==="decimal-brackets"?["(1)","(2)","(3)"]:
    lt.ls==="lower-alpha-paren"?["a)","b)","c)"]:
    lt.ls==="lower-alpha"?["a.","b.","c."]:
    lt.ls==="upper-alpha"?["A.","B.","C."]:
    lt.ls==="lower-roman"?["i.","ii.","iii."]:
    lt.ls==="upper-roman"?["I.","II.","III."]:
    lt.ls==="custom-urdu"?["۱.","۲.","۳."]:["1.","2.","3."]

  // Small square format button helper
  const FmtBtn=({title,onMD,children,style:st={},active=false})=>(
    <RBtn title={title} onMouseDown={onMD} active={active} style={{width:26,height:26,fontSize:13,...st}}>{children}</RBtn>
  )

  return(<>
    {/* UNDO / REDO */}
    <RGroup label="Undo / Redo">
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <RBtn title="Undo (Ctrl+Z)" onMouseDown={customUndo}
          disabled={!canUndo}
          style={{width:70,height:26,fontSize:12,gap:4}}>↩ Undo</RBtn>
        <RBtn title="Redo (Ctrl+Y)" onMouseDown={customRedo}
          disabled={!canRedo}
          style={{width:70,height:26,fontSize:12,gap:4}}>↪ Redo</RBtn>
      </div>
    </RGroup>

    {/* WORD-LIKE CLIPBOARD */}
    <RGroup label="Clipboard">
      <div style={{display:"flex",alignItems:"center",gap:3}}>
        <RBtn title="Paste (Ctrl+V)" vertical onMouseDown={pasteClipboard}
          style={{width:48,height:56,fontSize:11}}>
          <span style={{fontSize:23,lineHeight:1}}>📋</span><span>Paste</span>
        </RBtn>
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          <RBtn title="Cut (Ctrl+X)" onMouseDown={cutSelection}
            style={{width:58,height:26,justifyContent:"flex-start"}}>✂ Cut</RBtn>
          <RBtn title="Copy (Ctrl+C)" onMouseDown={copySelection}
            style={{width:58,height:26,justifyContent:"flex-start"}}>⧉ Copy</RBtn>
        </div>
      </div>
    </RGroup>

    {/* FONT */}
    <RGroup label="Font">
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          <select name="font-family" value={toolbarFontFamily} onMouseDown={e=>{e.stopPropagation();saveSelection()}}
            onChange={e=>{setToolbarFontFamily(e.target.value);applyFontFamily(e.target.value)}}
            style={{...ss(148),height:24,fontSize:12}}>
            {orderedFonts.map(f=><option key={primaryFontName(f.value)} value={f.value}>{f.label}</option>)}
          </select>
          <select name="font-size" value={toolbarFontSize} onMouseDown={e=>{e.stopPropagation();saveSelection()}}
            onChange={e=>{const s=parseInt(e.target.value);setToolbarFontSize(s);applyFontSize(s)}}
            style={{...ss(44),height:24,fontSize:12}}>
            {!FONT_SIZES.includes(toolbarFontSize)&&<option value={toolbarFontSize}>{toolbarFontSize}</option>}
            {FONT_SIZES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <FmtBtn title="Grow Font" onMD={()=>{const s=Math.min(toolbarFontSize+2,72);setToolbarFontSize(s);applyFontSize(s)}} style={{fontWeight:700,fontSize:14}}>A↑</FmtBtn>
          <FmtBtn title="Shrink Font" onMD={()=>{const s=Math.max(toolbarFontSize-2,8);setToolbarFontSize(s);applyFontSize(s)}} style={{fontSize:14}}>A↓</FmtBtn>
          <FmtBtn title="Clear All Formatting" onMD={clearAllFormatting} style={{fontSize:13}}>✕A</FmtBtn>
        </div>
        <div style={{display:"flex",gap:2,alignItems:"center"}}>
          <FmtBtn title="Bold (Ctrl+B)" onMD={()=>exec("bold")} style={{fontWeight:"900",fontSize:14,width:26}}>B</FmtBtn>
          <FmtBtn title="Italic (Ctrl+I)" onMD={()=>exec("italic")} style={{fontStyle:"italic",fontSize:14,width:26}}>I</FmtBtn>
          <FmtBtn title="Underline (Ctrl+U)" onMD={()=>exec("underline")} style={{textDecoration:"underline",fontSize:14,width:26}}>U</FmtBtn>
          <FmtBtn title="Strikethrough" onMD={()=>exec("strikeThrough")} style={{textDecoration:"line-through",fontSize:13,width:26}}>S</FmtBtn>
          <FmtBtn title="Subscript" onMD={()=>exec("subscript")} style={{fontSize:11,width:26}}>x₂</FmtBtn>
          <FmtBtn title="Superscript" onMD={()=>exec("superscript")} style={{fontSize:11,width:26}}>x²</FmtBtn>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
            <input type="color" value={activeFontColor} title="Font Color — select text, then choose a colour"
              aria-label="Font Color" onMouseDown={e=>{e.stopPropagation();saveSelection()}}
              onChange={e=>{const color=e.target.value;setActiveFontColor(color);exec("foreColor",color)}}
              style={{width:27,height:23,padding:1,border:`1px solid ${BORDER}`,borderRadius:2,
                cursor:"pointer",background:activeFontColor}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
            <input type="color" value={activeHighlightColor} title="Text Highlight Color — select text, then choose a colour"
              aria-label="Text Highlight Color" onMouseDown={e=>{e.stopPropagation();saveSelection()}}
              onChange={e=>{const color=e.target.value;setActiveHighlightColor(color);exec("hiliteColor",color)}}
              style={{width:27,height:23,padding:1,border:`1px solid ${BORDER}`,borderRadius:2,
                cursor:"pointer",background:activeHighlightColor}}/>
          </div>
        </div>
      </div>
    </RGroup>

    {/* PARAGRAPH */}
    <RGroup label="Paragraph">
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <div style={{display:"flex",gap:2,alignItems:"center"}}>
          {/* List dropdown */}
          <RBtn ref={lBtnRef} title="Bullets" onMouseDown={e=>toggleList(e,"ul",lBtnRef)}
            active={activeListTag==="ul"||(listOpen&&listKind==="ul")}
            style={{width:38,height:26,fontSize:13}}>• ≡ <span style={{fontSize:8}}>▼</span></RBtn>
          <RBtn ref={nBtnRef} title="Numbering" onMouseDown={e=>toggleList(e,"ol",nBtnRef)}
            active={(activeListTag==="ol"&&!activeMultilevel)||(listOpen&&listKind==="ol")}
            style={{width:42,height:26,fontSize:12}}>1. ≡ <span style={{fontSize:8}}>▼</span></RBtn>
          <RBtn ref={mBtnRef} title="Multilevel List" onMouseDown={e=>toggleList(e,"multi",mBtnRef)}
            active={!!activeMultilevel||(listOpen&&listKind==="multi")}
            style={{width:48,height:26,fontSize:11}}>1.1 ≡ <span style={{fontSize:8}}>▼</span></RBtn>
          <FmtBtn title="Decrease Indent" onMD={()=>applyParagraphIndent(false)} style={{fontSize:13}}>⇤</FmtBtn>
          <FmtBtn title="Increase Indent" onMD={()=>applyParagraphIndent(true)} style={{fontSize:13}}>⇥</FmtBtn>
          {/* Sort/paragraph mark */}
          <FmtBtn title="Show/Hide Paragraph Marks" onMD={()=>setShowParagraphMarks(value=>!value)}
            active={showParagraphMarks} style={{fontWeight:700,fontSize:14}}>¶</FmtBtn>
        </div>
        <div style={{display:"flex",gap:2,alignItems:"center"}}>
          <FmtBtn title="Align Right" onMD={()=>{applyParagraphAlignment("right");setActiveAlignment("right")}} active={activeAlignment==="right"} style={{fontSize:14}}>≡→</FmtBtn>
          <FmtBtn title="Align Center" onMD={()=>{applyParagraphAlignment("center");setActiveAlignment("center")}} active={activeAlignment==="center"} style={{fontSize:14}}>≡</FmtBtn>
          <FmtBtn title="Align Left" onMD={()=>{applyParagraphAlignment("left");setActiveAlignment("left")}} active={activeAlignment==="left"} style={{fontSize:14}}>←≡</FmtBtn>
          <FmtBtn title="Justify" onMD={()=>{applyParagraphAlignment("justify");setActiveAlignment("justify")}} active={activeAlignment==="justify"} style={{fontSize:14}}>⌸</FmtBtn>
          {/* Line spacing quick pick */}
          <select value={activeLineSpacing} title="Line Spacing"
            onMouseDown={e=>{e.stopPropagation();saveSelection()}}
            onChange={e=>{setActiveLineSpacing(e.target.value);applyParagraphLineSpacing(e.target.value)}}
            style={{...ss(54),height:24,fontSize:11}}>
            {["1","1.15","1.5","2","2.5","3"].map(v=><option key={v} value={v}>{v}× spacing</option>)}
          </select>
        </div>
      </div>
    </RGroup>

    {/* STYLES */}
    <RGroup label="Styles">
      <select value={activeParagraphStyle} onMouseDown={event=>{event.stopPropagation();saveSelection()}}
        onChange={event=>{
          const styleName=event.target.value
          setActiveParagraphStyle(styleName)
          applyParagraphStyle(styleName)
        }} style={{...ss(148),height:52,fontSize:12,overflowY:"auto"}}>
        <option value="p">¶ Normal Text</option>
        <option value="noSpacing">No Spacing</option>
        <option value="h1">H1 — Title</option>
        <option value="subtitle">Subtitle</option>
        <option value="h2">H2 — Heading 1</option>
        <option value="h3">H3 — Heading 2</option>
        <option value="h4">H4 — Heading 3</option>
        <option value="numbered">1.1 Numbered</option>
        <option value="blockquote">❝ Quote</option>
      </select>
    </RGroup>

    {/* List dropdown portal */}
    {listOpen&&createPortal(
      <div ref={lMenuRef} style={{position:"fixed",top:listPos.top,left:listPos.left,
        background:"#fdfdfd",border:"1px solid #9a9a9a",borderRadius:1,
        boxShadow:"0 5px 16px rgba(0,0,0,.28)",zIndex:999999,
        width:listKind==="ul"?420:listKind==="ol"?430:500,
        padding:"5px 8px 9px",fontFamily:"Segoe UI,sans-serif"}}>

        {listKind==="ul"&&<>
          {sectionBar("Recently Used Bullets")}
          <div style={{display:"flex",gap:7,padding:"0 4px"}}>
            <button onMouseDown={e=>e.preventDefault()} onClick={()=>{insertList(bulletTypes[0]);setListOpen(false)}}
              style={{width:58,height:54,border:"1px solid #aaa",background:"#fff",fontSize:25,cursor:"pointer"}}>●</button>
          </div>
          {sectionBar("Bullet Library")}
          <div style={{display:"flex",flexWrap:"wrap",gap:7,padding:"0 4px"}}>
            <button onMouseDown={e=>e.preventDefault()} onClick={()=>{removeList();setListOpen(false)}}
              style={{width:58,height:54,border:"1px solid #aaa",background:!activeListTag?BTN_ACTIVE_BG:"#fff",fontSize:12,cursor:"pointer"}}>None</button>
            {bulletTypes.map(lt=>{
              const selected=activeListTag==="ul"&&(lt.ls==="custom"?activeListStyle===lt.custom:activeListStyle===lt.ls)
              return <button key={lt.label} title={lt.label} onMouseDown={e=>e.preventDefault()}
                onClick={()=>{insertList(lt);setListOpen(false)}}
                style={{width:58,height:54,border:selected?`2px solid ${WORD_BLUE}`:"1px solid #aaa",
                  background:selected?BTN_ACTIVE_BG:"#fff",fontSize:lt.icon==="➤"?29:24,cursor:"pointer"}}>{lt.icon}</button>
            })}
          </div>
          {sectionBar("Document Bullets")}
          <div style={{display:"flex",gap:7,padding:"0 4px 4px"}}>
            <button onMouseDown={e=>e.preventDefault()} onClick={()=>{insertList(bulletTypes[0]);setListOpen(false)}}
              style={{width:58,height:54,border:"1px solid #aaa",background:"#fff",fontSize:25,cursor:"pointer"}}>●</button>
          </div>
        </>}

        {listKind==="ol"&&<>
          {sectionBar("Numbering Library")}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:7,padding:"0 4px"}}>
            <button onMouseDown={e=>e.preventDefault()} onClick={()=>{removeList();setListOpen(false)}}
              style={{height:86,border:"1px solid #aaa",background:!activeListTag?BTN_ACTIVE_BG:"#fff",fontSize:15,cursor:"pointer"}}>None</button>
            {numberTypes.map(lt=>{
              const selected=activeListTag==="ol"&&!activeMultilevel&&activeListStyle===lt.ls
              return <button key={lt.label} title={lt.label} onMouseDown={e=>e.preventDefault()}
                onClick={()=>{insertList(lt);setListOpen(false)}}
                style={{height:86,padding:"10px 8px",border:selected?`2px solid ${WORD_BLUE}`:"1px solid #aaa",
                  background:selected?BTN_ACTIVE_BG:"#fff",cursor:"pointer",display:"flex",flexDirection:"column",gap:8}}>
                {numberMarkers(lt).map((marker,index)=><span key={index}
                  style={{display:"flex",alignItems:"center",gap:6,height:12}}>
                  <span style={{width:25,textAlign:"right",fontSize:12,color:"#222"}}>{marker}</span>
                  <span style={{height:1,background:"#777",flex:1}}/>
                </span>)}
              </button>
            })}
          </div>
        </>}

        {listKind==="multi"&&<>
          {activeMultilevel&&<>
            {sectionBar("Current List")}
            <div style={{display:"flex",padding:"0 4px 4px"}}>
              {MULTILEVEL_TYPES.filter(type=>type.id===activeMultilevel).map(type=>(
                <button key={type.id} onMouseDown={e=>e.preventDefault()}
                  style={{width:150,height:88,border:`2px solid ${WORD_BLUE}`,
                    background:BTN_ACTIVE_BG,padding:"9px 8px",display:"flex",
                    flexDirection:"column",gap:8}}>
                  {type.preview.map((value,index)=><span key={index} style={{display:"flex",
                    alignItems:"center",gap:5,paddingLeft:index*8,height:10}}>
                    <span style={{minWidth:48,textAlign:"right",fontSize:10}}>{value}</span>
                    <span style={{height:1,background:"#777",flex:1}}/>
                  </span>)}
                </button>
              ))}
            </div>
          </>}
          {sectionBar("List Library")}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:7,padding:"0 4px"}}>
            <button onMouseDown={e=>e.preventDefault()} onClick={()=>{removeList();setListOpen(false)}}
              style={{height:92,border:"1px solid #aaa",background:!activeListTag?BTN_ACTIVE_BG:"#fff",
                fontSize:15,cursor:"pointer"}}>None</button>
            {MULTILEVEL_TYPES.map(type=>(
              <button key={type.id} title={type.label} onMouseDown={e=>e.preventDefault()}
                onClick={()=>{insertMultilevelList(type);setListOpen(false)}}
                style={{height:92,padding:"10px 7px",
                  border:activeMultilevel===type.id?`2px solid ${WORD_BLUE}`:"1px solid #aaa",
                  background:activeMultilevel===type.id?BTN_ACTIVE_BG:"#fff",cursor:"pointer",
                  display:"flex",flexDirection:"column",justifyContent:"center",gap:8}}>
                {type.preview.map((value,index)=><span key={index} style={{display:"flex",
                  alignItems:"center",gap:5,paddingLeft:index*8,height:11,whiteSpace:"nowrap"}}>
                  <span style={{minWidth:index===2?48:42,textAlign:"right",fontSize:index===2?9:10}}>{value}</span>
                  <span style={{height:1,background:"#777",flex:1}}/>
                </span>)}
              </button>
            ))}
          </div>
          <div style={{padding:"8px 6px 1px",fontSize:10,color:"#666"}}>
            Tab: increase level &nbsp;•&nbsp; Shift+Tab: decrease level
          </div>
        </>}
      </div>,document.body
    )}
  </>)
}

// ✅ FULL INSERT RIBBON — All shapes, charts, header/footer, page number, page border
function InsertRibbon({exec,openTableDlg,insertTable,openImageDlg,insertDate,insertDateTime,insertLink,
  insertShape,insertChart,openChartEditor,openTOC,applyHeaderPreset,applyFooterPreset,applyPageNumberPreset,
  removeHeader,removeFooter,removePageNumber,
  showHeader,showFooter,pageNumber,openCoverPage,insertBlankPage,insertPageBreak,insertTextBox,openTextBoxDlg,insertHorizontalLine,
  customShapes=[],insertCustomShape}){
  const [shapeMenuOpen,setShapeMenuOpen]=useState(false)
  const [shapeMenuPos,setShapeMenuPos]=useState({top:0,left:0})
  const [symbolMenu,setSymbolMenu]=useState(null)
  const [symbolMenuPos,setSymbolMenuPos]=useState({top:0,left:0})
  const [tableMenuOpen,setTableMenuOpen]=useState(false)
  const [tableMenuPos,setTableMenuPos]=useState({top:0,left:0})
  const [tableHover,setTableHover]=useState({rows:0,cols:0})
  const [headerFooterMenu,setHeaderFooterMenu]=useState(null)
  const [headerFooterMenuPos,setHeaderFooterMenuPos]=useState({top:0,left:0})
  const shapeBtnRef=useRef(null)
  const symbolBtnRef=useRef(null)
  const equationBtnRef=useRef(null)
  const tableBtnRef=useRef(null)
  const headerBtnRef=useRef(null)
  const footerBtnRef=useRef(null)
  const pageNumberBtnRef=useRef(null)

  const HEADER_PRESETS=[
    {id:"blank",name:"Blank",align:"center",preview:"Header"},
    {id:"blank-left",name:"Blank (Left)",align:"left",preview:"Header"},
    {id:"blank-right",name:"Blank (Right)",align:"right",preview:"Header"},
    {id:"banded",name:"Banded",align:"center",preview:"HEADER"},
    {id:"austin",name:"Austin",align:"right",preview:"Document title"},
    {id:"facet",name:"Facet",align:"left",preview:"Document title"},
  ]
  const FOOTER_PRESETS=[
    {id:"blank-left",name:"Blank (Left)",align:"left",preview:"Footer"},
    {id:"blank",name:"Blank (Center)",align:"center",preview:"Footer"},
    {id:"blank-right",name:"Blank (Right)",align:"right",preview:"Footer"},
    {id:"banded",name:"Banded",align:"center",preview:"FOOTER"},
    {id:"austin",name:"Austin",align:"left",preview:"Document title"},
    {id:"facet",name:"Facet",align:"right",preview:"Document title"},
  ]
  const PAGE_NUMBER_PRESETS=[
    {id:"top-left",name:"Top of Page — Left",position:"top-left",format:"number"},
    {id:"top-center",name:"Top of Page — Center",position:"top-center",format:"number"},
    {id:"top-right",name:"Top of Page — Right",position:"top-right",format:"number"},
    {id:"bottom-left",name:"Bottom — Left",position:"bottom-left",format:"number"},
    {id:"bottom-center",name:"Bottom — Center",position:"bottom-center",format:"number"},
    {id:"bottom-right",name:"Bottom — Right",position:"bottom-right",format:"number"},
    {id:"page-of",name:"Page 1 of 3",position:"bottom-center",format:"pageOf"},
    {id:"page-label",name:"Page 1",position:"bottom-right",format:"page"},
    {id:"roman",name:"I, II, III",position:"bottom-center",format:"roman"},
    {id:"roman-lower",name:"i, ii, iii",position:"bottom-center",format:"romanLower"},
    {id:"alpha",name:"A, B, C",position:"bottom-center",format:"alpha"},
    {id:"alpha-lower",name:"a, b, c",position:"bottom-center",format:"alphaLower"},
  ]

  function openHeaderFooterGallery(kind,ref){
    if(headerFooterMenu===kind){setHeaderFooterMenu(null);return}
    const rect=ref.current?.getBoundingClientRect()
    const width=kind==="pageNumber"?430:390
    setHeaderFooterMenuPos({
      top:(rect?.bottom||60)+4,
      left:Math.max(8,Math.min(rect?.left||100,window.innerWidth-width-8)),
    })
    setHeaderFooterMenu(kind)
  }

  const SYMBOL_GROUPS=[
    {group:"Kashmiri Letters & Carriers",symbols:[
      ["ؠ","Kashmiri Yeh"],["ٲ","Alef with wavy hamza above"],["ۄ","Waw with ring"],
      ["ا","Alef"],["آ","Alef with madda"],["أ","Alef with hamza above"],
      ["إ","Alef with hamza below"],["و","Waw"],["ی","Farsi Yeh"],["ے","Bari Yeh"],
      ["ں","Noon Ghunna"],["ھ","Heh Doachashmee"],
    ]},
    {group:"Kashmiri Vowel Marks",symbols:[
      ["َ","Zabar / Fatha"],["ِ","Zer / Kasra"],["ُ","Pesh / Damma"],["ْ","Jazm / Sukun"],
      ["ّ","Tashdid / Shadda"],["ٰ","Superscript Alef"],["ٔ","Hamza above"],["ٕ","Hamza below"],
      ["ٖ","Subscript Alef"],["ٗ","Inverted Damma"],["ٚ","Small V above"],["ٟ","Wavy hamza below"],
    ]},
    {group:"Punctuation & Religious",symbols:[
      ["؟","Question mark"],["،","Comma"],["۔","Full stop"],["؛","Semicolon"],["٪","Percent"],
      ["٭","Star"],["«","Opening quote"],["»","Closing quote"],["ﷺ","Peace blessing"],["ؑ","Honorific"],
    ]},
    {group:"Math & Greek",symbols:[
      ["±","Plus-minus"],["×","Multiply"],["÷","Divide"],["≠","Not equal"],["≤","Less/equal"],
      ["≥","Greater/equal"],["∞","Infinity"],["√","Square root"],["∑","Sum"],["∫","Integral"],
      ["π","Pi"],["α","Alpha"],["β","Beta"],["θ","Theta"],["λ","Lambda"],["Ω","Omega"],
    ]},
    {group:"Arrows & Currency",symbols:[
      ["→","Right arrow"],["←","Left arrow"],["↑","Up arrow"],["↓","Down arrow"],["↔","Both directions"],
      ["₹","Rupee"],["$","Dollar"],["€","Euro"],["£","Pound"],["©","Copyright"],["®","Registered"],["™","Trademark"],
    ]},
  ]

  const eqSlot=(text,width=30)=>{
    const safe=String(text).replace(/[&<>]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[char]))
    return `<span data-equation-slot="true" contenteditable="true"
      style="display:inline-block;min-width:${width}px;padding:0 3px;text-align:center;outline:none;
      border-bottom:1px dotted #9aa7b5;background:#fffdf2;">${safe}</span>`
  }
  const EQUATION_SYMBOL_GROUPS=[
    {name:"Basic Math",symbols:[
      ["+","Plus"],["−","Minus"],["×","Multiply"],["÷","Divide"],["=","Equals"],["≠","Not equal"],
      ["<","Less than"],[">","Greater than"],["≤","Less than or equal"],["≥","Greater than or equal"],
      ["±","Plus or minus"],["∓","Minus or plus"],["∞","Infinity"],["√","Square root"],["∝","Proportional"],
      ["≈","Approximately"],["≡","Identical"],["%","Percent"],["°","Degree"],["′","Prime"],["″","Double prime"],
    ]},
    {name:"Calculus & Sets",symbols:[
      ["∑","Summation"],["∏","Product"],["∫","Integral"],["∬","Double integral"],["∂","Partial derivative"],
      ["∇","Nabla"],["∆","Delta"],["∈","Element of"],["∉","Not an element"],["∩","Intersection"],
      ["∪","Union"],["⊂","Subset"],["⊆","Subset or equal"],["∅","Empty set"],["∀","For all"],
      ["∃","There exists"],["∴","Therefore"],["∵","Because"],["∠","Angle"],["⊥","Perpendicular"],
    ]},
    {name:"Greek Letters",symbols:[
      ["α","Alpha"],["β","Beta"],["γ","Gamma"],["δ","Delta"],["ε","Epsilon"],["θ","Theta"],
      ["λ","Lambda"],["μ","Mu"],["π","Pi"],["ρ","Rho"],["σ","Sigma"],["φ","Phi"],
      ["ω","Omega"],["Γ","Gamma"],["Δ","Delta"],["Θ","Theta"],["Λ","Lambda"],["Σ","Sigma"],
      ["Φ","Phi"],["Ω","Omega"],
    ]},
  ]
  const EQUATION_TEMPLATES=[
    {id:"fraction",label:"Fraction",preview:"a⁄b",html:`<span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;"><span style="border-bottom:1.5px solid currentColor;">${eqSlot("a")}</span>${eqSlot("b")}</span>`},
    {id:"binomial",label:"Binomial",preview:"(n over k)",html:`<span style="font-size:1.8em;">(</span><span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;">${eqSlot("n",24)}${eqSlot("k",24)}</span><span style="font-size:1.8em;">)</span>`},
    {id:"power",label:"Superscript",preview:"xⁿ",html:`${eqSlot("x")}<sup>${eqSlot("n",18)}</sup>`},
    {id:"subscript",label:"Subscript",preview:"xₙ",html:`${eqSlot("x")}<sub>${eqSlot("n",18)}</sub>`},
    {id:"subsup",label:"Subscript & Power",preview:"xₙᵐ",html:`${eqSlot("x")}<span style="display:inline-flex;flex-direction:column;font-size:.75em;line-height:1;"><sup>${eqSlot("m",18)}</sup><sub>${eqSlot("n",18)}</sub></span>`},
    {id:"root",label:"Square Root",preview:"√x",html:`<span style="font-size:1.35em;">√</span><span style="border-top:1.5px solid currentColor;">${eqSlot("x",38)}</span>`},
    {id:"nth-root",label:"Nth Root",preview:"ⁿ√x",html:`<sup>${eqSlot("n",18)}</sup><span style="font-size:1.35em;">√</span><span style="border-top:1.5px solid currentColor;">${eqSlot("x",38)}</span>`},
    {id:"integral",label:"Integral",preview:"∫ f(x) dx",html:`<span style="font-size:1.6em;">∫</span>${eqSlot("f(x)",52)}<span>d</span>${eqSlot("x",18)}`},
    {id:"def-integral",label:"Definite Integral",preview:"∫ₐᵇ f(x)dx",html:`<span style="display:inline-flex;flex-direction:column;align-items:center;line-height:.75;"><small>${eqSlot("b",18)}</small><span style="font-size:1.8em;">∫</span><small>${eqSlot("a",18)}</small></span>${eqSlot("f(x)",48)}<span>d</span>${eqSlot("x",18)}`},
    {id:"double-integral",label:"Double Integral",preview:"∬ f dA",html:`<span style="font-size:1.6em;">∬</span>${eqSlot("f(x,y)",58)}<span>d</span>${eqSlot("A",18)}`},
    {id:"sum",label:"Summation",preview:"Σ xᵢ",html:`<span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:.8;"><small>${eqSlot("n",18)}</small><b style="font-size:1.5em;">∑</b><small>${eqSlot("i=1",26)}</small></span>${eqSlot("xᵢ",34)}`},
    {id:"product",label:"Product",preview:"Π xᵢ",html:`<span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:.8;"><small>${eqSlot("n",18)}</small><b style="font-size:1.45em;">∏</b><small>${eqSlot("i=1",26)}</small></span>${eqSlot("xᵢ",34)}`},
    {id:"limit",label:"Limit",preview:"lim f(x)",html:`<span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1;"><span>lim</span><small>${eqSlot("x→0",34)}</small></span>${eqSlot("f(x)",48)}`},
    {id:"log",label:"Logarithm",preview:"logₐ(x)",html:`<span>log</span><sub>${eqSlot("a",18)}</sub><span>(</span>${eqSlot("x",30)}<span>)</span>`},
    {id:"trig",label:"Trigonometric",preview:"sin²(θ)",html:`<span>sin</span><sup>${eqSlot("2",18)}</sup><span>(</span>${eqSlot("θ",28)}<span>)</span>`},
    {id:"derivative",label:"Derivative",preview:"dy/dx",html:`<span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;"><span style="border-bottom:1.5px solid currentColor;">d${eqSlot("y",18)}</span><span>d${eqSlot("x",18)}</span></span>`},
    {id:"partial",label:"Partial Derivative",preview:"∂f/∂x",html:`<span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;"><span style="border-bottom:1.5px solid currentColor;">∂${eqSlot("f",18)}</span><span>∂${eqSlot("x",18)}</span></span>`},
    {id:"parentheses",label:"Parentheses",preview:"( a+b )",html:`<span style="font-size:1.8em;">(</span>${eqSlot("a+b",60)}<span style="font-size:1.8em;">)</span>`},
    {id:"brackets",label:"Brackets",preview:"[ a+b ]",html:`<span style="font-size:1.8em;">[</span>${eqSlot("a+b",60)}<span style="font-size:1.8em;">]</span>`},
    {id:"absolute",label:"Absolute Value",preview:"|x|",html:`<span style="font-size:1.5em;">|</span>${eqSlot("x",32)}<span style="font-size:1.5em;">|</span>`},
    {id:"vector",label:"Vector",preview:"→v",html:`<span style="display:inline-flex;flex-direction:column;align-items:center;line-height:.75;"><span>→</span>${eqSlot("v",28)}</span>`},
    {id:"overbar",label:"Overbar",preview:"x̅",html:`<span style="border-top:1.5px solid currentColor;padding-top:1px;">${eqSlot("x",32)}</span>`},
    {id:"quadratic",label:"Quadratic",preview:"x=(-b±√…)/2a",html:`<span>x = </span><span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;"><span style="border-bottom:1.5px solid currentColor;">−${eqSlot("b",18)} ± √(${eqSlot("b²−4ac",58)})</span><span>2${eqSlot("a",18)}</span></span>`},
    {id:"matrix",label:"2 × 2 Matrix",preview:"[ a b; c d ]",html:`<span style="font-size:1.8em;">[</span><table style="display:inline-table;width:auto;border-collapse:collapse;vertical-align:middle;"><tbody><tr><td style="border:none;padding:1px 5px;">${eqSlot("a",20)}</td><td style="border:none;padding:1px 5px;">${eqSlot("b",20)}</td></tr><tr><td style="border:none;padding:1px 5px;">${eqSlot("c",20)}</td><td style="border:none;padding:1px 5px;">${eqSlot("d",20)}</td></tr></tbody></table><span style="font-size:1.8em;">]</span>`},
    {id:"matrix3",label:"3 × 3 Matrix",preview:"[ 3 × 3 ]",html:`<span style="font-size:2.3em;">[</span><table style="display:inline-table;width:auto;border-collapse:collapse;vertical-align:middle;"><tbody>${[0,1,2].map(row=>`<tr>${[0,1,2].map(col=>`<td style="border:none;padding:1px 3px;">${eqSlot(String.fromCharCode(97+row*3+col),18)}</td>`).join("")}</tr>`).join("")}</tbody></table><span style="font-size:2.3em;">]</span>`},
    {id:"cases",label:"Cases",preview:"{ x, x≥0",html:`<span style="font-size:2.5em;">{</span><table style="display:inline-table;width:auto;border-collapse:collapse;vertical-align:middle;"><tbody><tr><td style="border:none;padding:1px 5px;">${eqSlot("x",28)}</td><td style="border:none;padding:1px 5px;">if ${eqSlot("x≥0",38)}</td></tr><tr><td style="border:none;padding:1px 5px;">${eqSlot("−x",28)}</td><td style="border:none;padding:1px 5px;">if ${eqSlot("x<0",38)}</td></tr></tbody></table>`},
  ]

  function openInsertGallery(kind,ref){
    if(symbolMenu===kind){setSymbolMenu(null);return}
    const rect=ref.current?.getBoundingClientRect()
    const width=kind==="symbols"?430:510
    setSymbolMenuPos({
      top:(rect?.bottom||60)+4,
      left:Math.max(8,Math.min(rect?.left||100,window.innerWidth-width-8)),
    })
    setSymbolMenu(kind)
  }
  function insertEquation(template){
    const id=`eq_${Date.now()}`
    exec("insertHTML",`<span id="${id}" data-equation="true" contenteditable="false"
      style="display:inline-flex;align-items:center;gap:2px;direction:ltr;unicode-bidi:isolate;
      font-family:'Cambria Math','STIX Two Math','Times New Roman',serif;font-size:1.08em;
      vertical-align:middle;margin:2px 4px;padding:3px 5px;border:1px solid transparent;">${template.html}</span><span data-equation-caret="${id}">\u200B</span>`)
    setSymbolMenu(null)
    setTimeout(()=>{
      const equation=document.getElementById(id)
      const slot=equation?.querySelector('[data-equation-slot="true"]')
      if(!slot)return
      slot.focus()
      const range=document.createRange();range.selectNodeContents(slot)
      const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
    },0)
  }

  const SHAPE_GROUPS=[
    {group:"Basic Shapes",shapes:[
      {type:"rect",    icon:"▭", label:"Rectangle"},
      {type:"square",  icon:"□", label:"Square"},
      {type:"circle",  icon:"○", label:"Circle"},
      {type:"oval",    icon:"⬭", label:"Oval"},
      {type:"triangle",icon:"△", label:"Triangle"},
      {type:"diamond", icon:"◇", label:"Diamond"},
      {type:"pentagon",icon:"⬠", label:"Pentagon"},
      {type:"hexagon", icon:"⬡", label:"Hexagon"},
      {type:"roundedrect",icon:"▢",label:"Rounded Rectangle"},
      {type:"parallelogram",icon:"▱",label:"Parallelogram"},
      {type:"trapezoid",icon:"⏢",label:"Trapezoid"},
      {type:"octagon",icon:"⯃",label:"Octagon"},
      {type:"heart",icon:"♡",label:"Heart"},
      {type:"moon",icon:"☾",label:"Moon"},
    ]},
    {group:"Lines & Arrows",shapes:[
      {type:"line",        icon:"—",  label:"Line"},
      {type:"arrow",       icon:"→",  label:"Arrow"},
      {type:"doublearrow", icon:"↔",  label:"Double Arrow"},
      {type:"curved",      icon:"⌒",  label:"Curved Line"},
    ]},
    {group:"Block Arrows",shapes:[
      {type:"leftarrow",icon:"←",label:"Left Arrow"},
      {type:"uparrow",icon:"↑",label:"Up Arrow"},
      {type:"downarrow",icon:"↓",label:"Down Arrow"},
      {type:"quadarrow",icon:"✥",label:"Four-Way Arrow"},
      {type:"chevron",icon:"❯",label:"Chevron"},
      {type:"notchedarrow",icon:"➜",label:"Notched Arrow"},
    ]},
    {group:"Flowchart",shapes:[
      {type:"process",   icon:"▬", label:"Process"},
      {type:"decision",  icon:"◇", label:"Decision"},
      {type:"terminal",  icon:"⬬", label:"Start/End"},
      {type:"connector", icon:"⬤", label:"Connector"},
    ]},
    {group:"Callouts",shapes:[
      {type:"speechbubble", icon:"💬", label:"Speech Bubble"},
      {type:"thoughtbubble",icon:"💭", label:"Thought Bubble"},
      {type:"commentbox",   icon:"📝", label:"Comment Box"},
    ]},
    {group:"Stars & Banners",shapes:[
      {type:"star",   icon:"★", label:"Star"},
      {type:"star6",  icon:"✶", label:"6-Point Star"},
      {type:"banner", icon:"🎗", label:"Banner"},
      {type:"ribbon", icon:"🏅", label:"Ribbon"},
      {type:"cloud",  icon:"☁", label:"Cloud"},
      {type:"sun",icon:"☀",label:"Sun"},
      {type:"lightning",icon:"ϟ",label:"Lightning Bolt"},
      {type:"plaque",icon:"✥",label:"Plaque"},
      {type:"wave",icon:"〰",label:"Wave"},
    ]},
  ]

  function openShapeMenu(e){
    if(shapeMenuOpen){setShapeMenuOpen(false);return}
    const r=shapeBtnRef.current?.getBoundingClientRect()
    setShapeMenuPos({top:(r?.bottom||60)+4,left:r?.left||100})
    setShapeMenuOpen(true)
  }
  function openTableMenu(){
    if(tableMenuOpen){setTableMenuOpen(false);return}
    const r=tableBtnRef.current?.getBoundingClientRect()
    setTableMenuPos({
      top:(r?.bottom||60)+4,
      left:Math.max(8,Math.min(r?.left||80,window.innerWidth-250)),
    })
    setTableHover({rows:0,cols:0})
    setTableMenuOpen(true)
  }

  useEffect(()=>{
    if(!shapeMenuOpen)return
    const fn=e=>{ if(!e.target.closest("#shape-dropdown")&&!e.target.closest("#shape-menu-btn"))setShapeMenuOpen(false) }
    document.addEventListener("mousedown",fn); return()=>document.removeEventListener("mousedown",fn)
  },[shapeMenuOpen])
  useEffect(()=>{
    if(!symbolMenu)return
    const close=event=>{
      if(!event.target.closest("#insert-symbol-gallery")
        &&!symbolBtnRef.current?.contains(event.target)
        &&!equationBtnRef.current?.contains(event.target))setSymbolMenu(null)
    }
    document.addEventListener("mousedown",close)
    return()=>document.removeEventListener("mousedown",close)
  },[symbolMenu])
  useEffect(()=>{
    if(!tableMenuOpen)return
    const close=event=>{
      if(!event.target.closest("#insert-table-gallery")
        &&!tableBtnRef.current?.contains(event.target))setTableMenuOpen(false)
    }
    document.addEventListener("mousedown",close)
    return()=>document.removeEventListener("mousedown",close)
  },[tableMenuOpen])
  useEffect(()=>{
    if(!headerFooterMenu)return
    const close=event=>{
      if(!event.target.closest("#header-footer-gallery")
        &&!headerBtnRef.current?.contains(event.target)
        &&!footerBtnRef.current?.contains(event.target)
        &&!pageNumberBtnRef.current?.contains(event.target))setHeaderFooterMenu(null)
    }
    document.addEventListener("mousedown",close)
    return()=>document.removeEventListener("mousedown",close)
  },[headerFooterMenu])

  return(<>
    {/* PAGES */}
    <RGroup label="Pages">
      <RBtn onClick={openCoverPage} vertical style={{minWidth:52,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:22}}>📄</span>
        <span>Cover Page</span>
      </RBtn>
      <RBtn onClick={insertBlankPage} vertical style={{minWidth:52,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:22}}>▱</span>
        <span>Blank Page</span>
      </RBtn>
      <RBtn onClick={insertPageBreak} vertical title="Page Break (Ctrl+Enter)"
        style={{minWidth:52,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:22}}>↵</span>
        <span>Page Break</span>
      </RBtn>
    </RGroup>
    <RGroup label="Table">
      <RBtn ref={tableBtnRef} onClick={openTableMenu} active={tableMenuOpen}
        vertical style={{minWidth:52,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:22}}>▦</span><span>Table ▾</span>
      </RBtn>
      {tableMenuOpen&&createPortal(
        <div id="insert-table-gallery" onMouseLeave={()=>setTableHover({rows:0,cols:0})}
          style={{position:"fixed",top:tableMenuPos.top,left:tableMenuPos.left,width:238,
            background:"#fff",border:`1px solid ${BORDER}`,boxShadow:"0 8px 24px rgba(0,0,0,.22)",
            zIndex:999999,padding:"8px 9px 7px",fontFamily:"Segoe UI,sans-serif"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#333",padding:"1px 2px 7px"}}>Insert Table</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(10,18px)",gap:3,justifyContent:"center"}}>
            {Array.from({length:80},(_,index)=>{
              const row=Math.floor(index/10)+1,col=index%10+1
              const selected=row<=tableHover.rows&&col<=tableHover.cols
              return <button key={index} title={`${row} × ${col} Table`}
                onMouseDown={event=>event.preventDefault()}
                onMouseEnter={()=>setTableHover({rows:row,cols:col})}
                onClick={()=>{insertTable(row,col,false,true);setTableMenuOpen(false)}}
                style={{width:18,height:18,padding:0,border:`1px solid ${selected?WORD_BLUE:"#9aa7b5"}`,
                  background:selected?"#dbeaf7":"#fff",cursor:"pointer"}}/>
            })}
          </div>
          <div style={{height:25,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,color:"#333",fontWeight:600}}>
            {tableHover.rows?`${tableHover.rows} × ${tableHover.cols} Table`:"Select table size"}
          </div>
          <button onMouseDown={event=>event.preventDefault()}
            onClick={()=>{setTableMenuOpen(false);openTableDlg()}}
            style={{width:"100%",border:"none",borderTop:`1px solid ${BORDER}`,background:"#fff",
              textAlign:"left",padding:"7px 6px 3px",fontSize:12,cursor:"pointer",color:"#222"}}>
            ▦ Insert Table…
          </button>
        </div>,document.body
      )}
    </RGroup>
    <RGroup label="Illustrations">
      <RBtn onClick={openImageDlg} vertical style={{minWidth:48,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:20}}>🖼</span><span>Image</span>
      </RBtn>
      <RBtn id="shape-menu-btn" ref={shapeBtnRef} onClick={openShapeMenu} active={shapeMenuOpen} vertical style={{minWidth:48,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:20}}>🔷</span><span>Shapes</span>
      </RBtn>
      <RBtn onClick={openChartEditor} vertical style={{minWidth:52,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:20}}>📊</span><span>Chart Ed.</span>
      </RBtn>
      {shapeMenuOpen&&createPortal(
        <div id="shape-dropdown" style={{position:"fixed",top:shapeMenuPos.top,left:shapeMenuPos.left,background:"#fff",border:`1px solid ${BORDER}`,borderRadius:6,boxShadow:"0 8px 24px rgba(0,0,0,.18)",zIndex:999999,width:380,padding:12,overflowY:"auto",maxHeight:420}}>
          {SHAPE_GROUPS.map(g=>(
            <div key={g.group} style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:WORD_BLUE,marginBottom:5,textTransform:"uppercase",letterSpacing:.5,fontFamily:"Segoe UI,sans-serif"}}>{g.group}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {g.shapes.map(s=>(
                  <button key={s.type} title={s.label} onMouseDown={e=>e.preventDefault()}
                    onClick={()=>{insertShape(s.type);setShapeMenuOpen(false)}}
                    onMouseEnter={e=>e.currentTarget.style.background=BTN_HOVER_BG}
                    onMouseLeave={e=>e.currentTarget.style.background="#f5f5f5"}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",border:`1px solid ${BORDER}`,borderRadius:4,background:"#f5f5f5",cursor:"pointer",minWidth:60,fontSize:20}}>
                    <span>{s.icon}</span>
                    <span style={{fontSize:9,color:"#555",whiteSpace:"nowrap",fontFamily:"Segoe UI,sans-serif"}}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {/* ADMIN PANEL ADDITION — custom shapes added from the admin panel */}
          {customShapes.length>0&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:WORD_BLUE,marginBottom:5,textTransform:"uppercase",letterSpacing:.5,fontFamily:"Segoe UI,sans-serif"}}>Custom</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {customShapes.map(s=>(
                  <button key={s._id} title={s.name} onMouseDown={e=>e.preventDefault()}
                    onClick={()=>{insertCustomShape?.(s.svgMarkup);setShapeMenuOpen(false)}}
                    onMouseEnter={e=>e.currentTarget.style.background=BTN_HOVER_BG}
                    onMouseLeave={e=>e.currentTarget.style.background="#f5f5f5"}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",border:`1px solid ${BORDER}`,borderRadius:4,background:"#f5f5f5",cursor:"pointer",minWidth:60,fontSize:20}}>
                    <span style={{width:20,height:20}} dangerouslySetInnerHTML={{__html:s.svgMarkup}}/>
                    <span style={{fontSize:9,color:"#555",whiteSpace:"nowrap",fontFamily:"Segoe UI,sans-serif"}}>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>,document.body
      )}
    </RGroup>
    <RGroup label="Links">
      <RBtn onClick={insertLink} vertical style={{minWidth:48,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:20}}>🔗</span><span>Link</span>
      </RBtn>
    </RGroup>
    <RGroup label="Header & Footer">
      <RBtn ref={headerBtnRef} onMouseDown={event=>{event.preventDefault();openHeaderFooterGallery("header",headerBtnRef)}}
        active={showHeader||headerFooterMenu==="header"} vertical style={{minWidth:54,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:18}}>↥</span><span>Header ▾</span>
      </RBtn>
      <RBtn ref={footerBtnRef} onMouseDown={event=>{event.preventDefault();openHeaderFooterGallery("footer",footerBtnRef)}}
        active={showFooter||headerFooterMenu==="footer"} vertical style={{minWidth:54,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:18}}>↧</span><span>Footer ▾</span>
      </RBtn>
      <RBtn ref={pageNumberBtnRef} onMouseDown={event=>{event.preventDefault();openHeaderFooterGallery("pageNumber",pageNumberBtnRef)}}
        active={pageNumber||headerFooterMenu==="pageNumber"} vertical style={{minWidth:62,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:18}}>№</span><span>Page Number ▾</span>
      </RBtn>
      {headerFooterMenu&&createPortal(
        <div id="header-footer-gallery" style={{position:"fixed",top:headerFooterMenuPos.top,left:headerFooterMenuPos.left,
          width:headerFooterMenu==="pageNumber"?430:390,maxHeight:460,overflowY:"auto",background:"#fff",
          border:`1px solid ${BORDER}`,boxShadow:"0 8px 24px rgba(0,0,0,.22)",zIndex:999999,
          padding:"8px 10px 10px",fontFamily:"Segoe UI,sans-serif"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#333",background:"#eef3f8",
            padding:"6px 8px",marginBottom:8}}>
            {headerFooterMenu==="header"?"Built-In Headers":headerFooterMenu==="footer"?"Built-In Footers":"Page Number Gallery"}
          </div>
          <div style={{display:"grid",gridTemplateColumns:headerFooterMenu==="pageNumber"?"repeat(3,1fr)":"repeat(2,1fr)",gap:7}}>
            {(headerFooterMenu==="header"?HEADER_PRESETS:headerFooterMenu==="footer"?FOOTER_PRESETS:PAGE_NUMBER_PRESETS).map(preset=>(
              <button key={preset.id} onMouseDown={event=>event.preventDefault()}
                onClick={()=>{
                  if(headerFooterMenu==="header")applyHeaderPreset?.(preset)
                  else if(headerFooterMenu==="footer")applyFooterPreset?.(preset)
                  else applyPageNumberPreset?.(preset)
                  setHeaderFooterMenu(null)
                }}
                style={{height:75,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",
                  padding:7,display:"flex",flexDirection:"column",justifyContent:"space-between",
                  fontFamily:"Segoe UI,sans-serif",textAlign:"left"}}>
                <span style={{height:38,width:"100%",boxSizing:"border-box",position:"relative",
                  border:"1px solid #d4d4d4",background:preset.id==="banded"?"#eaf2fb":"#fff",
                  borderTop:preset.id==="austin"?"3px double #2b579a":"1px solid #d4d4d4",
                  borderLeft:preset.id==="facet"?"7px solid #2b579a":"1px solid #d4d4d4",
                  display:"flex",alignItems:(headerFooterMenu==="header"||String(preset.position||"").startsWith("top"))?"flex-start":"flex-end",
                  justifyContent:preset.align==="left"||String(preset.position||"").endsWith("left")?"flex-start":preset.align==="right"||String(preset.position||"").endsWith("right")?"flex-end":"center",
                  padding:"5px 8px",fontSize:9,color:"#566"}}>
                  {headerFooterMenu==="pageNumber"
                    ?(preset.format==="pageOf"?"Page 1 of 3":preset.format==="page"?"Page 1":preset.format==="roman"?"I":preset.format==="romanLower"?"i":preset.format==="alpha"?"A":preset.format==="alphaLower"?"a":"1")
                    :preset.preview}
                </span>
                <span style={{fontSize:10,color:"#333"}}>{preset.name}</span>
              </button>
            ))}
          </div>
          <button onMouseDown={event=>event.preventDefault()} onClick={()=>{
              if(headerFooterMenu==="header")removeHeader?.()
              else if(headerFooterMenu==="footer")removeFooter?.()
              else removePageNumber?.()
              setHeaderFooterMenu(null)
            }}
            style={{width:"100%",marginTop:9,padding:"7px 9px",border:"none",borderTop:`1px solid ${BORDER}`,
              background:"#fff",color:"#a4262c",cursor:"pointer",textAlign:"left",fontSize:11}}>
            {headerFooterMenu==="header"?"Remove Header":headerFooterMenu==="footer"?"Remove Footer":"Remove Page Numbers"}
          </button>
        </div>,document.body
      )}
    </RGroup>
    <RGroup label="Text">
      <RBtn onClick={openTextBoxDlg} vertical style={{minWidth:48,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:20}}>⬜</span><span>Text Box</span>
      </RBtn>

      <RBtn onClick={insertDate} vertical style={{minWidth:44,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:18}}>📅</span><span>Date</span>
      </RBtn>
      <RBtn onMouseDown={event=>event.preventDefault()} onClick={insertHorizontalLine}
        title="Insert a horizontal line and continue typing below it"
        vertical style={{minWidth:44,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:18}}>—</span><span>H-Line</span>
      </RBtn>
    </RGroup>
    <RGroup label="Contents">
      <RBtn onMouseDown={event=>event.preventDefault()} onClick={openTOC}
        title="Insert or update a Table of Contents from Heading 1–3"
        vertical style={{minWidth:74,height:58,gap:3,fontSize:10}}>
        <span style={{fontSize:20}}>📑</span><span>Table of Contents</span>
      </RBtn>
    </RGroup>
    <RGroup label="Symbols">
      <RBtn ref={equationBtnRef} title="Insert Equation"
        onMouseDown={event=>{event.preventDefault();openInsertGallery("equations",equationBtnRef)}}
        active={symbolMenu==="equations"} vertical style={{minWidth:58,height:58,gap:2,fontSize:10}}>
        <span style={{fontFamily:"Cambria Math,serif",fontSize:23}}>π</span>
        <span>Equation ▾</span>
      </RBtn>
      <RBtn ref={symbolBtnRef} title="Insert Symbol"
        onMouseDown={event=>{event.preventDefault();openInsertGallery("symbols",symbolBtnRef)}}
        active={symbolMenu==="symbols"} vertical style={{minWidth:58,height:58,gap:2,fontSize:10}}>
        <span style={{fontFamily:"Cambria Math,serif",fontSize:23}}>Ω</span>
        <span>Symbol ▾</span>
      </RBtn>
      {symbolMenu&&createPortal(
        <div id="insert-symbol-gallery" style={{position:"fixed",top:symbolMenuPos.top,left:symbolMenuPos.left,
          width:symbolMenu==="symbols"?430:510,maxHeight:450,overflowY:"auto",background:"#fff",
          border:`1px solid ${BORDER}`,boxShadow:"0 8px 24px rgba(0,0,0,.22)",zIndex:999999,
          padding:"8px 10px 12px",fontFamily:"Segoe UI,sans-serif"}}>
          {symbolMenu==="symbols"?SYMBOL_GROUPS.map(group=>(
            <div key={group.group} style={{marginBottom:9}}>
              <div style={{fontSize:10,fontWeight:700,color:WORD_BLUE,background:"#eef3f8",
                padding:"5px 7px",marginBottom:5}}>{group.group}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:4}}>
                {group.symbols.map(([symbol,label])=>(
                  <button key={`${group.group}-${symbol}`} title={label}
                    onMouseDown={event=>event.preventDefault()}
                    onClick={()=>{exec("insertText",symbol);setSymbolMenu(null)}}
                    style={{height:37,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",
                      fontSize:20,fontFamily:"'Noto Naskh Arabic','Segoe UI Symbol',serif",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>{symbol}</button>
                ))}
              </div>
            </div>
          )):(
            <>
              {EQUATION_SYMBOL_GROUPS.map(group=>(
                <div key={group.name} style={{marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:700,color:WORD_BLUE,background:"#eef3f8",
                    padding:"5px 7px",marginBottom:5}}>{group.name}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3}}>
                    {group.symbols.map(([symbol,label])=>(
                      <button key={`${group.name}-${symbol}`} title={label}
                        onMouseDown={event=>event.preventDefault()}
                        onClick={()=>{exec("insertText",symbol);setSymbolMenu(null)}}
                        style={{height:31,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",
                          fontSize:18,fontFamily:"Cambria Math,'STIX Two Math','Times New Roman',serif",
                          display:"flex",alignItems:"center",justifyContent:"center"}}>{symbol}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{fontSize:11,fontWeight:700,color:WORD_BLUE,background:"#eef3f8",
                padding:"6px 8px",marginBottom:7}}>Structures & Built-In Equations</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
                {EQUATION_TEMPLATES.map(template=>(
                  <button key={template.id} title={template.label}
                    onMouseDown={event=>event.preventDefault()}
                    onClick={()=>insertEquation(template)}
                    style={{height:70,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      gap:7,fontFamily:"Cambria Math,'Times New Roman',serif"}}>
                    <span style={{fontSize:18,whiteSpace:"nowrap"}}>{template.preview}</span>
                    <span style={{fontSize:10,color:"#555",fontFamily:"Segoe UI,sans-serif"}}>{template.label}</span>
                  </button>
                ))}
              </div>
              <div style={{fontSize:10,color:"#666",padding:"9px 3px 0"}}>
                Click an equation, then type inside its highlighted editable slots.
              </div>
            </>
          )}
        </div>,document.body
      )}
    </RGroup>
  </>)
}

function TableDesignRibbon({table,applyStyle,toggleOption,setCellShading,setBorderColor,setBorderWidth,setBorderStyle}){
  const styles=[
    {id:"plain",name:"Plain",head:"#ffffff",band:"#ffffff",text:"#111",border:"#b7b7b7"},
    {id:"blue-medium",name:"Blue",head:"#2b579a",band:"#d9e8f5",text:"#fff",border:"#8aa9c7"},
    {id:"blue-light",name:"Light Blue",head:"#5b9bd5",band:"#deebf7",text:"#fff",border:"#9dc3e6"},
    {id:"orange",name:"Orange",head:"#ed7d31",band:"#fce4d6",text:"#fff",border:"#f4b183"},
    {id:"green",name:"Green",head:"#548235",band:"#e2f0d9",text:"#fff",border:"#a9d18e"},
    {id:"purple",name:"Purple",head:"#7030a0",band:"#e4dfec",text:"#fff",border:"#b4a7d6"},
    {id:"red",name:"Red",head:"#c00000",band:"#f4cccc",text:"#fff",border:"#e6b8b7"},
    {id:"dark",name:"Dark",head:"#333f50",band:"#d6dce4",text:"#fff",border:"#8497b0"},
  ]
  const smallButton={height:22,padding:"1px 7px",border:`1px solid ${BORDER}`,background:"#fff",fontSize:10,cursor:"pointer",borderRadius:2}
  return <div data-table-ribbon="true" style={{display:"contents"}}>
    <RGroup label="Table Style Options">
      {[["header","Header Row"],["first","First Column"],["last","Last Column"],["banded","Banded Rows"]].map(([key,label])=>(
        <label key={key} onMouseDown={event=>event.stopPropagation()}
          style={{display:"flex",alignItems:"center",gap:4,fontSize:10,height:22,whiteSpace:"nowrap",cursor:"pointer"}}>
          <input type="checkbox" defaultChecked={key==="header"||key==="banded"}
            onChange={event=>toggleOption(table,key,event.target.checked)}/>{label}
        </label>
      ))}
    </RGroup>
    <RGroup label="Table Styles">
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,50px)",gap:3,paddingTop:2}}>
        {styles.map(style=><button key={style.id} title={style.name}
          onMouseDown={event=>event.preventDefault()} onClick={()=>applyStyle(table,style)}
          style={{height:25,padding:2,border:`1px solid ${style.border}`,background:"#fff",cursor:"pointer",borderRadius:2}}>
          <span style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gridTemplateRows:"repeat(2,1fr)",height:"100%",gap:1}}>
            {[0,1,2,3,4,5].map(index=><i key={index} style={{background:index<3?style.head:style.band}}/>)}
          </span>
        </button>)}
      </div>
    </RGroup>
    <RGroup label="Shading">
      <label style={{fontSize:10,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <input type="color" defaultValue="#ffffff" onMouseDown={event=>event.stopPropagation()}
          onChange={event=>setCellShading(table,event.target.value)}
          style={{width:34,height:29,padding:1,border:`1px solid ${BORDER}`,cursor:"pointer"}}/>
        Cell Color
      </label>
    </RGroup>
    <RGroup label="Borders">
      <div style={{display:"flex",flexDirection:"column",gap:3,paddingTop:2}}>
        <select defaultValue="solid" onMouseDown={event=>event.stopPropagation()}
          onChange={event=>setBorderStyle(table,event.target.value)} style={smallButton}>
          <option value="solid">Solid</option><option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option><option value="double">Double</option><option value="none">No Border</option>
        </select>
        <select defaultValue="1" onMouseDown={event=>event.stopPropagation()}
          onChange={event=>setBorderWidth(table,event.target.value)} style={smallButton}>
          <option value="0.5">½ pt</option><option value="1">1 pt</option>
          <option value="1.5">1½ pt</option><option value="2">2 pt</option><option value="3">3 pt</option>
        </select>
      </div>
      <label style={{fontSize:9,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <input type="color" defaultValue="#b7b7b7" onMouseDown={event=>event.stopPropagation()}
          onChange={event=>setBorderColor(table,event.target.value)}
          style={{width:32,height:27,padding:1,border:`1px solid ${BORDER}`,cursor:"pointer"}}/>
        Pen Color
      </label>
    </RGroup>
  </div>
}

function TableLayoutRibbon({insertRow,insertColumn,deleteRow,deleteColumn,deleteCell,deleteTable,mergeCells,splitCell,splitTable}){
  const toolStyle={height:25,padding:"3px 8px",border:`1px solid ${BORDER}`,background:"#fff",borderRadius:2,cursor:"pointer",fontSize:10,whiteSpace:"nowrap"}
  const Tool=({children,onClick,danger=false})=><button onMouseDown={event=>event.preventDefault()} onClick={onClick}
    style={{...toolStyle,color:danger?"#b42318":"#222",background:danger?"#fff5f5":"#fff"}}>{children}</button>
  return <div data-table-ribbon="true" style={{display:"contents"}}>
    <RGroup label="Rows & Columns">
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,auto)",gap:4,paddingTop:2}}>
        <Tool onClick={()=>insertRow(true)}>↑ Insert Above</Tool>
        <Tool onClick={()=>insertRow(false)}>↓ Insert Below</Tool>
        <Tool onClick={()=>insertColumn(true)}>← Insert Left</Tool>
        <Tool onClick={()=>insertColumn(false)}>→ Insert Right</Tool>
      </div>
    </RGroup>
    <RGroup label="Delete">
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,auto)",gap:4,paddingTop:2}}>
        <Tool danger onClick={deleteRow}>Delete Row</Tool>
        <Tool danger onClick={deleteColumn}>Delete Column</Tool>
        <Tool danger onClick={deleteCell}>Delete Cell</Tool>
        <Tool danger onClick={deleteTable}>Delete Table</Tool>
      </div>
    </RGroup>
    <RGroup label="Merge">
      <div style={{display:"flex",flexDirection:"column",gap:4,paddingTop:2}}>
        <Tool onClick={mergeCells}>⊞ Merge Cells</Tool>
        <Tool onClick={splitCell}>▥ Split Cells</Tool>
      </div>
    </RGroup>
    <RGroup label="Table">
      <Tool onClick={splitTable}>⇵ Split Table</Tool>
    </RGroup>
  </div>
}

function LayoutRibbon({orientation,onOrientationChange,pagesRef,
  pageMargins,onPageMarginsChange,indentLeft,setIndentLeft,indentRight,setIndentRight,
  spaceBefore,setSpaceBefore,spaceAfter,setSpaceAfter,
  applyLayoutParagraphFormat,
  theme,pageColor,onApplyPageColor,
  pageBorderSetting,pageBorderStyle,pageBorderWidth,pageBorderColor,pageBorderSides,onApplyPageBorder}){

  const [marginMenuOpen,setMarginMenuOpen]=useState(false)
  const [marginMenuPos,setMarginMenuPos]=useState({top:0,left:0})
  const marginButtonRef=useRef(null)
  const [pageColorMenuOpen,setPageColorMenuOpen]=useState(false)
  const [pageColorMenuPos,setPageColorMenuPos]=useState({top:0,left:0})
  const pageColorButtonRef=useRef(null)
  const pageColorPreviewBaseRef=useRef(null)
  const [pageBorderMenuOpen,setPageBorderMenuOpen]=useState(false)
  const [pageBorderMenuPos,setPageBorderMenuPos]=useState({top:0,left:0})
  const pageBorderButtonRef=useRef(null)
  const [pageBorderDraft,setPageBorderDraft]=useState({
    setting:pageBorderSetting,style:pageBorderStyle==="none"?"solid":pageBorderStyle,
    width:pageBorderWidth,color:pageBorderColor,sides:pageBorderSides,
  })
  const measureEditingRef=useRef(null)
  const [measureDrafts,setMeasureDrafts]=useState({
    left:String(indentLeft),right:String(indentRight),
    before:String(spaceBefore),after:String(spaceAfter),
  })
  useEffect(()=>{
    const values={left:indentLeft,right:indentRight,before:spaceBefore,after:spaceAfter}
    setMeasureDrafts(previous=>{
      const next={...previous}
      Object.entries(values).forEach(([property,value])=>{
        if(measureEditingRef.current!==property)next[property]=String(value)
      })
      return next
    })
  },[indentLeft,indentRight,spaceBefore,spaceAfter])
  const MARGINS=[
    {id:"normal",name:"Normal",top:96,bottom:96,left:96,right:96},
    {id:"narrow",name:"Narrow",top:48,bottom:48,left:48,right:48},
    {id:"moderate",name:"Moderate",top:96,bottom:96,left:72,right:72},
    {id:"wide",name:"Wide",top:96,bottom:96,left:192,right:192},
  ]
  const marginCm=value=>(Number(value)/96*2.54).toFixed(2)
  function applyIndentLeft(val,returnCaret=false){
    applyLayoutParagraphFormat("left",val,returnCaret)
  }
  function cancelPageColorPreview(clearBase=false){
    const base=pageColorPreviewBaseRef.current
    if(!base)return
    onApplyPageColor(base,{recordHistory:false,notify:false,preview:true})
    if(clearBase)pageColorPreviewBaseRef.current=null
  }
  function closePageColorGallery(){
    cancelPageColorPreview(true)
    setPageColorMenuOpen(false)
  }
  function closePageBorderGallery(){
    setPageBorderDraft({
      setting:pageBorderSetting,style:pageBorderStyle==="none"?"solid":pageBorderStyle,
      width:pageBorderWidth,color:pageBorderColor,sides:pageBorderSides,
    })
    setPageBorderMenuOpen(false)
  }
  useEffect(()=>{
    if(pageBorderMenuOpen)return
    setPageBorderDraft({
      setting:pageBorderSetting,style:pageBorderStyle==="none"?"solid":pageBorderStyle,
      width:pageBorderWidth,color:pageBorderColor,sides:pageBorderSides,
    })
  },[pageBorderSetting,pageBorderStyle,pageBorderWidth,pageBorderColor,pageBorderSides,pageBorderMenuOpen])
  function applyIndentRight(val,returnCaret=false){
    applyLayoutParagraphFormat("right",val,returnCaret)
  }
  const clampMeasure=(value,max,step)=>{
    const clamped=Math.max(0,Math.min(max,Number(value)||0))
    const precision=step<1?1:0
    return Number(clamped.toFixed(precision))
  }
  const measureControl=(label,value,property,unit,step,max)=>{
    const applyValue=(next,returnCaret=false)=>{
      const number=clampMeasure(next,max,step)
      setMeasureDrafts(previous=>({...previous,[property]:String(number)}))
      if(property==="left")applyIndentLeft(number,returnCaret)
      else if(property==="right")applyIndentRight(number,returnCaret)
      else applyLayoutParagraphFormat(property,number,returnCaret)
    }
    const draft=measureDrafts[property]??String(value)
    return <div style={{display:"flex",alignItems:"center",gap:4}}>
      <span style={{fontSize:10,color:"#777",width:unit==="cm"?30:36}}>{label}</span>
      <span data-layout-measure={property} style={{display:"flex",height:24,border:`1px solid ${BORDER}`,borderRadius:3,
        overflow:"hidden",background:"#fff"}}>
        <input type="text" inputMode="decimal" value={draft}
          aria-label={`${label} ${unit}`}
          onFocus={event=>{
            measureEditingRef.current=property
            setMeasureDrafts(previous=>({...previous,[property]:String(value)}))
            requestAnimationFrame(()=>event.currentTarget.select())
          }}
          onChange={event=>{
            const raw=event.target.value.replace(",",".")
            if(!/^\d*(?:\.\d*)?$/.test(raw))return
            setMeasureDrafts(previous=>({...previous,[property]:raw}))
            // Keep a valid value as a live Word-style preview, while retaining
            // an unfinished decimal such as "1." in the input for the next
            // keystroke instead of collapsing it to "1".
            if(raw!==""&&raw!=="."){
              const number=clampMeasure(Number(raw),max,step)
              if(property==="left")applyIndentLeft(number,false)
              else if(property==="right")applyIndentRight(number,false)
              else applyLayoutParagraphFormat(property,number,false)
            }
          }}
          onKeyDown={event=>{
            if(event.key==="Enter"){
              event.preventDefault()
              measureEditingRef.current=null
              applyValue(event.currentTarget.value,true)
              event.currentTarget.blur()
            }else if(event.key==="Escape"){
              event.preventDefault()
              measureEditingRef.current=null
              setMeasureDrafts(previous=>({...previous,[property]:String(value)}))
              event.currentTarget.blur()
              applyValue(value,true)
            }
          }}
          onBlur={event=>{
            if(measureEditingRef.current!==property)return
            measureEditingRef.current=null
            applyValue(event.currentTarget.value||0,false)
          }}
          style={{width:unit==="cm"?46:40,padding:"2px 4px",border:0,outline:"none",fontSize:12}}/>
        <span style={{display:"flex",flexDirection:"column",width:15,borderLeft:`1px solid ${BORDER}`}}>
          <button type="button" aria-label={`Increase ${label}`} title={`Increase ${label}`}
            onMouseDown={event=>event.preventDefault()}
            onClick={()=>{
              measureEditingRef.current=null
              applyValue(Number(draft||value)+step,true)
            }}
            style={{height:11.5,padding:0,border:0,borderBottom:`1px solid ${BORDER}`,
              background:"#f6f6f6",fontSize:7,lineHeight:"8px",cursor:"pointer"}}>▲</button>
          <button type="button" aria-label={`Decrease ${label}`} title={`Decrease ${label}`}
            onMouseDown={event=>event.preventDefault()}
            onClick={()=>{
              measureEditingRef.current=null
              applyValue(Number(draft||value)-step,true)
            }}
            style={{height:11.5,padding:0,border:0,background:"#f6f6f6",
              fontSize:7,lineHeight:"8px",cursor:"pointer"}}>▼</button>
        </span>
      </span>
      <span style={{fontSize:10,color:"#999"}}>{unit}</span>
    </div>
  }
  const activeMargin=MARGINS.find(preset=>
    ["top","bottom","left","right"].every(side=>Number(pageMargins?.[side])===preset[side])
  )||MARGINS[0]
  function openMarginGallery(){
    if(marginMenuOpen){setMarginMenuOpen(false);return}
    const rect=marginButtonRef.current?.getBoundingClientRect()
    setMarginMenuPos({
      top:(rect?.bottom||60)+4,
      left:Math.max(8,Math.min(rect?.left||100,window.innerWidth-292)),
    })
    setMarginMenuOpen(true)
  }
  useEffect(()=>{
    if(!marginMenuOpen)return
    const close=event=>{
      if(!event.target.closest("#word-margin-gallery")
        &&!marginButtonRef.current?.contains(event.target))setMarginMenuOpen(false)
    }
    document.addEventListener("mousedown",close)
    return()=>document.removeEventListener("mousedown",close)
  },[marginMenuOpen])
  useEffect(()=>{
    if(!pageColorMenuOpen)return
    const close=event=>{
      if(!event.target.closest("#word-page-color-gallery")
        &&!pageColorButtonRef.current?.contains(event.target))closePageColorGallery()
    }
    document.addEventListener("mousedown",close)
    return()=>document.removeEventListener("mousedown",close)
  },[pageColorMenuOpen])
  useEffect(()=>{
    if(!pageBorderMenuOpen)return
    const close=event=>{
      if(!event.target.closest("#word-page-border-gallery")
        &&!pageBorderButtonRef.current?.contains(event.target))closePageBorderGallery()
    }
    document.addEventListener("mousedown",close)
    return()=>document.removeEventListener("mousedown",close)
  },[pageBorderMenuOpen])
  useEffect(()=>{
    const syncParagraphValues=()=>{
      const selection=window.getSelection()
      if(!selection?.rangeCount)return
      const node=selection.anchorNode?.nodeType===1
        ?selection.anchorNode
        :selection.anchorNode?.parentElement
      const paragraph=node?.closest?.("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre")
      // Word moves a list marker and its text as one paragraph. The actual
      // physical left/right margins therefore live on the list container,
      // while ordinary paragraphs keep the margin on the block itself.
      const indentBlock=paragraph?.tagName==="LI"
        ?paragraph.parentElement
        :paragraph
      const spacingBlock=paragraph
      const ownerPage=pagesRef.current.find(page=>page?.contains(paragraph))
      if(!paragraph||!indentBlock||!ownerPage||paragraph===ownerPage)return
      const indentComputed=getComputedStyle(indentBlock)
      const spacingComputed=getComputedStyle(spacingBlock)
      const cmFromPx=px=>Math.round((parseFloat(px)||0)*2.54/96*100)/100
      const ptFromPx=px=>Math.round((parseFloat(px)||0)*72/96*10)/10
      // Treat the ribbon's first indent as the paragraph's leading edge and
      // the second as its trailing edge. That makes the controls visibly move
      // the caret in both LTR and RTL writing, matching Word's direction-aware
      // paragraph indentation.
      setIndentLeft(indentBlock.hasAttribute("data-word-left")
        ?Number(indentBlock.getAttribute("data-word-left"))||0:cmFromPx(indentComputed.marginInlineStart))
      setIndentRight(indentBlock.hasAttribute("data-word-right")
        ?Number(indentBlock.getAttribute("data-word-right"))||0:cmFromPx(indentComputed.marginInlineEnd))
      setSpaceBefore(spacingBlock.hasAttribute("data-word-before")
        ?Number(spacingBlock.getAttribute("data-word-before"))||0:ptFromPx(spacingComputed.marginTop))
      setSpaceAfter(spacingBlock.hasAttribute("data-word-after")
        ?Number(spacingBlock.getAttribute("data-word-after"))||0:ptFromPx(spacingComputed.marginBottom))
    }
    document.addEventListener("selectionchange",syncParagraphValues)
    syncParagraphValues()
    return()=>document.removeEventListener("selectionchange",syncParagraphValues)
  },[pagesRef,setIndentLeft,setIndentRight,setSpaceBefore,setSpaceAfter])

  const currentThemeColors=DOCUMENT_THEMES[theme]||DOCUMENT_THEMES.Office
  const pageColorPalette=[...new Set([
    currentThemeColors.page,currentThemeColors.accent1,currentThemeColors.accent2,currentThemeColors.accent3,
    "#ffffff","#f2f2f2","#d9eaf7","#e2f0d9","#fff2cc","#fce4d6","#eadcf8",
    "#000000","#7f7f7f","#c00000","#ff0000","#ffc000","#ffff00","#70ad47",
    "#00b0f0","#4472c4","#7030a0",
  ])]

  return(<>
    {/* ORIENTATION */}
    <RGroup label="Page Setup">
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <span style={{fontSize:10,color:"#777"}}>Orientation</span>
        <select value={orientation} onMouseDown={e=>e.stopPropagation()}
          onChange={e=>onOrientationChange(e.target.value)} style={ss(130)}>
          <option value="portrait">Portrait (A4)</option>
          <option value="landscape">Landscape (A4)</option>
        </select>
        <span style={{fontSize:9,color:"#888",textAlign:"center"}}>
          {orientation==="portrait"?"210 × 297 mm":"297 × 210 mm"}
        </span>
      </div>
    </RGroup>

    {/* MARGINS */}
    <RGroup label="Margins">
      <RBtn ref={marginButtonRef} onMouseDown={event=>event.preventDefault()} onClick={openMarginGallery}
        active={marginMenuOpen} vertical title="Choose page margins"
        style={{minWidth:76,height:58,gap:2,fontSize:10}}>
        <span style={{display:"inline-block",width:24,height:31,background:"#fff",border:"1px solid #777",
          boxShadow:"inset 4px 0 #d6dce4,inset -4px 0 #d6dce4,inset 0 4px #d6dce4,inset 0 -4px #d6dce4"}}/>
        <span>{activeMargin.name} ▾</span>
      </RBtn>
      {marginMenuOpen&&createPortal(
        <div id="word-margin-gallery" style={{position:"fixed",top:marginMenuPos.top,left:marginMenuPos.left,
          width:282,background:"#fff",border:`1px solid ${BORDER}`,boxShadow:"0 8px 24px rgba(0,0,0,.24)",
          zIndex:999999,padding:"5px 5px 7px",fontFamily:"Segoe UI,sans-serif"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#333",background:"#eef3f8",padding:"6px 8px",marginBottom:6}}>
            Built-In Margins
          </div>
          {MARGINS.map(preset=>{
            const active=preset.id===activeMargin.id
            const previewScale=.18
            return <button key={preset.id} onMouseDown={event=>event.preventDefault()}
              onClick={()=>{onPageMarginsChange(preset);setMarginMenuOpen(false)}}
              style={{width:"100%",height:68,display:"flex",alignItems:"center",gap:12,padding:"6px 8px",
                border:active?`2px solid ${WORD_BLUE}`:"1px solid transparent",background:active?"#eaf2fb":"#fff",
                cursor:"pointer",textAlign:"left",marginBottom:1}}>
              <span style={{position:"relative",display:"inline-block",width:43,height:52,
                border:"1px solid #8c8c8c",background:"#fff",flexShrink:0}}>
                <span style={{position:"absolute",background:"#fff",
                  top:preset.top*previewScale/2,left:preset.left*previewScale/2,
                  right:preset.right*previewScale/2,bottom:preset.bottom*previewScale/2,
                  border:"1px solid #5b9bd5"}}/>
              </span>
              <span style={{display:"flex",flexDirection:"column",gap:3,flex:1}}>
                <strong style={{fontSize:12,color:"#222",fontWeight:600}}>{preset.name}</strong>
                <span style={{display:"grid",gridTemplateColumns:"1fr 1fr",columnGap:9,rowGap:1,fontSize:9.5,color:"#555"}}>
                  <span>Top: {marginCm(preset.top)} cm</span>
                  <span>Bottom: {marginCm(preset.bottom)} cm</span>
                  <span>Left: {marginCm(preset.left)} cm</span>
                  <span>Right: {marginCm(preset.right)} cm</span>
                </span>
              </span>
              {active&&<span style={{marginLeft:"auto",color:WORD_BLUE,fontWeight:700}}>✓</span>}
            </button>
          })}
        </div>,document.body
      )}
    </RGroup>

    {/* INDENTATION */}
    <RGroup label="Indentation">
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {measureControl("Left",indentLeft,"left","cm",0.1,20)}
        {measureControl("Right",indentRight,"right","cm",0.1,20)}
      </div>
    </RGroup>

    {/* SPACING */}
    <RGroup label="Spacing">
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {measureControl("Before",spaceBefore,"before","pt",1,100)}
        {measureControl("After",spaceAfter,"after","pt",1,100)}
      </div>
    </RGroup>

    {/* PAGE COLOR */}
    <RGroup label="Page Color">
      <RBtn ref={pageColorButtonRef} vertical active={pageColorMenuOpen}
        title="Choose the document page colour"
        onMouseDown={event=>event.preventDefault()}
        onClick={()=>{
          if(pageColorMenuOpen){closePageColorGallery();return}
          const rect=pageColorButtonRef.current?.getBoundingClientRect()
          pageColorPreviewBaseRef.current=pageColor
          setPageColorMenuPos({
            top:(rect?.bottom||60)+4,
            left:Math.max(8,Math.min(rect?.left||100,window.innerWidth-250)),
          })
          setPageColorMenuOpen(true)
        }}
        style={{minWidth:70,height:58,gap:2,fontSize:10}}>
        <span style={{width:28,height:30,background:pageColor,border:"1px solid #777",
          boxShadow:`inset 0 -5px ${currentThemeColors.accent1}`}}/>
        <span>Page Color ▾</span>
      </RBtn>
      {pageColorMenuOpen&&createPortal(
        <div id="word-page-color-gallery" onMouseLeave={()=>cancelPageColorPreview(false)}
          style={{position:"fixed",top:pageColorMenuPos.top,left:pageColorMenuPos.left,width:240,
            background:"#fff",border:`1px solid ${BORDER}`,boxShadow:"0 8px 24px rgba(0,0,0,.24)",
            zIndex:999999,padding:7,fontFamily:"Segoe UI,sans-serif"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#333",background:"#eef3f8",padding:"6px 8px",marginBottom:6}}>
            Theme & Standard Colors
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,26px)",gap:5,justifyContent:"center"}}>
            {pageColorPalette.map(color=><button key={color} title={color}
              onMouseDown={event=>event.preventDefault()}
              onMouseEnter={()=>onApplyPageColor(color,{recordHistory:false,notify:false,preview:true})}
              onFocus={()=>onApplyPageColor(color,{recordHistory:false,notify:false,preview:true})}
              onClick={()=>{
                pageColorPreviewBaseRef.current=null
                onApplyPageColor(color,{recordHistory:true,notify:true})
                setPageColorMenuOpen(false)
              }}
              style={{width:26,height:26,padding:0,background:color,
                border:pageColor.toLowerCase()===color.toLowerCase()?`2px solid ${WORD_BLUE}`:"1px solid #888",
                cursor:"pointer"}}/>)}
          </div>
          <button onMouseDown={event=>event.preventDefault()}
            onMouseEnter={()=>onApplyPageColor("#ffffff",{recordHistory:false,notify:false,preview:true})}
            onClick={()=>{
              pageColorPreviewBaseRef.current=null
              onApplyPageColor("#ffffff",{recordHistory:true,notify:true})
              setPageColorMenuOpen(false)
            }}
            style={{width:"100%",marginTop:8,padding:"6px 8px",background:"#fff",
              border:"1px solid #ccc",cursor:"pointer",fontSize:11,textAlign:"left"}}>
            ⊘ No Color
          </button>
          <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            marginTop:5,padding:"5px 8px",border:"1px solid #ccc",fontSize:11,cursor:"pointer"}}>
            <span>More Colors…</span>
            <input type="color" value={pageColor}
              onMouseDown={event=>event.stopPropagation()}
              onInput={event=>onApplyPageColor(event.currentTarget.value,{recordHistory:false,notify:false,preview:true})}
              onChange={event=>{
                pageColorPreviewBaseRef.current=null
                onApplyPageColor(event.currentTarget.value,{recordHistory:true,notify:true})
                setPageColorMenuOpen(false)
              }}
              style={{width:34,height:24,padding:1,border:"1px solid #aaa",cursor:"pointer"}}/>
          </label>
        </div>,document.body
      )}
    </RGroup>

    {/* PAGE BORDER OPTIONS */}
    <RGroup label="Page Border">
      <RBtn ref={pageBorderButtonRef} vertical active={pageBorderMenuOpen}
        title="Open Borders and Shading"
        onMouseDown={event=>event.preventDefault()}
        onClick={()=>{
          if(pageBorderMenuOpen){closePageBorderGallery();return}
          const rect=pageBorderButtonRef.current?.getBoundingClientRect()
          setPageBorderDraft({
            setting:pageBorderSetting,style:pageBorderStyle==="none"?"solid":pageBorderStyle,
            width:pageBorderWidth,color:pageBorderColor,sides:pageBorderSides,
          })
          setPageBorderMenuPos({
            top:(rect?.bottom||60)+4,
            left:Math.max(8,Math.min(rect?.left||100,window.innerWidth-526)),
          })
          setPageBorderMenuOpen(true)
        }}
        style={{minWidth:74,height:58,gap:2,fontSize:10}}>
        <span style={{width:28,height:32,background:"#fff",boxSizing:"border-box",
          border:pageBorderStyle!=="none"?`${Math.min(3,pageBorderWidth)}px ${pageBorderStyle} ${pageBorderColor}`:"1px solid #aaa",
          boxShadow:pageBorderSetting==="shadow"?"3px 3px 0 rgba(0,0,0,.35)":"none"}}/>
        <span>Page Borders ▾</span>
      </RBtn>
      {pageBorderMenuOpen&&createPortal(
        <div id="word-page-border-gallery" style={{position:"fixed",top:pageBorderMenuPos.top,left:pageBorderMenuPos.left,
          width:516,background:"#fff",border:`1px solid ${BORDER}`,boxShadow:"0 10px 30px rgba(0,0,0,.28)",
          zIndex:999999,padding:10,fontFamily:"Segoe UI,sans-serif",color:"#222"}}>
          <div style={{fontSize:12,fontWeight:700,background:"#eef3f8",padding:"7px 9px",marginBottom:9}}>
            Borders and Shading — Page Border
          </div>
          <div style={{display:"grid",gridTemplateColumns:"205px 1fr",gap:14}}>
            <div>
              <div style={{fontSize:10,color:"#666",marginBottom:5}}>Setting</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                {[
                  ["none","None"],["box","Box"],["shadow","Shadow"],["3d","3-D"],["custom","Custom"],
                ].map(([setting,label])=><button key={setting}
                  onMouseDown={event=>event.preventDefault()}
                  onClick={()=>setPageBorderDraft(previous=>({
                    ...previous,setting,
                    sides:setting==="none"
                      ?{top:false,right:false,bottom:false,left:false}
                      :setting==="custom"
                        ?previous.sides
                        :{top:true,right:true,bottom:true,left:true},
                    style:setting==="3d"?"groove":previous.style,
                  }))}
                  style={{height:54,padding:3,border:pageBorderDraft.setting===setting?`2px solid ${WORD_BLUE}`:"1px solid #bbb",
                    background:pageBorderDraft.setting===setting?"#eaf2fb":"#fff",cursor:"pointer",fontSize:9}}>
                  <span style={{display:"block",width:24,height:28,margin:"0 auto 2px",background:"#fff",
                    border:setting==="none"?"1px solid #bbb":setting==="3d"?"3px groove #777":"2px solid #555",
                    boxShadow:setting==="shadow"?"3px 3px 0 #777":"none"}}/>
                  {label}
                </button>)}
              </div>
              <label style={{display:"block",fontSize:10,color:"#666",marginTop:12,marginBottom:4}}>Style</label>
              <select value={pageBorderDraft.style} disabled={pageBorderDraft.setting==="none"}
                onChange={event=>setPageBorderDraft(previous=>({...previous,style:event.target.value}))}
                style={{...ss(195),height:29}}>
                <option value="solid">Solid line</option>
                <option value="double">Double line</option>
                <option value="dashed">Dashed line</option>
                <option value="dotted">Dotted line</option>
                <option value="groove">3-D groove</option>
                <option value="ridge">3-D ridge</option>
              </select>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:9}}>
                <label style={{fontSize:10,color:"#666"}}>Color
                  <input type="color" value={pageBorderDraft.color}
                    onChange={event=>setPageBorderDraft(previous=>({...previous,color:event.target.value}))}
                    style={{display:"block",width:"100%",height:28,padding:1,border:"1px solid #aaa",marginTop:3}}/>
                </label>
                <label style={{fontSize:10,color:"#666"}}>Width
                  <select value={pageBorderDraft.width}
                    onChange={event=>setPageBorderDraft(previous=>({...previous,width:Number(event.target.value)}))}
                    style={{...ss("100%"),height:28,marginTop:3}}>
                    {[.5,1,1.5,2.25,3,4.5,6].map(width=>
                      <option key={width} value={width}>{width} pt</option>
                    )}
                  </select>
                </label>
              </div>
              <div style={{fontSize:9.5,color:"#666",marginTop:12}}>Apply to: Whole document</div>
            </div>
            <div>
              <div style={{fontSize:10,color:"#666",marginBottom:8}}>Preview</div>
              <div style={{height:225,display:"flex",alignItems:"center",justifyContent:"center",
                background:"#f2f2f2",border:"1px solid #ddd"}}>
                {(()=>{
                  const visible=pageBorderDraft.setting!=="none"
                  const value=`${pageBorderDraft.width}pt ${pageBorderDraft.style} ${pageBorderDraft.color}`
                  const sides=pageBorderDraft.sides
                  const toggle=side=>setPageBorderDraft(previous=>({
                    ...previous,setting:"custom",
                    sides:{...previous.sides,[side]:!previous.sides[side]},
                  }))
                  return <div style={{position:"relative",width:132,height:178}}>
                    <div style={{position:"absolute",inset:8,background:"#fff",
                      borderTop:visible&&sides.top?value:"1px solid #ddd",
                      borderRight:visible&&sides.right?value:"1px solid #ddd",
                      borderBottom:visible&&sides.bottom?value:"1px solid #ddd",
                      borderLeft:visible&&sides.left?value:"1px solid #ddd",
                      boxShadow:pageBorderDraft.setting==="shadow"?"7px 7px 0 rgba(0,0,0,.35)":"none",
                      boxSizing:"border-box",padding:14}}>
                      {[70,86,60,78,52].map((width,index)=>
                        <span key={index} style={{display:"block",width:`${width}%`,height:3,
                          background:index===0?currentThemeColors.accent1:"#c7c7c7",marginBottom:8}}/>
                      )}
                    </div>
                    <button title="Toggle top border" onMouseDown={event=>event.preventDefault()} onClick={()=>toggle("top")}
                      style={{position:"absolute",top:-5,left:51,width:30,height:20,cursor:"pointer"}}>Top</button>
                    <button title="Toggle right border" onMouseDown={event=>event.preventDefault()} onClick={()=>toggle("right")}
                      style={{position:"absolute",right:-28,top:77,width:42,height:20,cursor:"pointer"}}>Right</button>
                    <button title="Toggle bottom border" onMouseDown={event=>event.preventDefault()} onClick={()=>toggle("bottom")}
                      style={{position:"absolute",bottom:-8,left:43,width:46,height:20,cursor:"pointer"}}>Bottom</button>
                    <button title="Toggle left border" onMouseDown={event=>event.preventDefault()} onClick={()=>toggle("left")}
                      style={{position:"absolute",left:-24,top:77,width:38,height:20,cursor:"pointer"}}>Left</button>
                  </div>
                })()}
              </div>
              <div style={{fontSize:9.5,color:"#777",marginTop:6,textAlign:"center"}}>
                Use the four buttons to create a custom border.
              </div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:7,marginTop:10}}>
            <button onMouseDown={event=>event.preventDefault()} onClick={closePageBorderGallery}
              style={{padding:"6px 18px",border:"1px solid #aaa",background:"#fff",cursor:"pointer"}}>Cancel</button>
            <button onMouseDown={event=>event.preventDefault()} onClick={()=>{
              onApplyPageBorder(pageBorderDraft,{recordHistory:true,notify:true})
              setPageBorderMenuOpen(false)
            }}
              style={{padding:"6px 20px",border:`1px solid ${WORD_BLUE}`,background:WORD_BLUE,color:"#fff",cursor:"pointer"}}>Apply</button>
          </div>
        </div>,document.body
      )}
    </RGroup>

  </>)
}

function ReviewRibbon({clearAll,docTitle,onTitleChange,onTitleBlur,saveNow,saving,savedMsg,showWordCount,
  customUndo,customRedo,selectAll,canUndo,canRedo}){
  const titleIsEmpty=!docTitle.trim()
  return(<>
    <RGroup label="Info"><RBtn onClick={showWordCount} style={{fontSize:12,minWidth:90}}>📊 Word Count</RBtn></RGroup>
    <RGroup label="Edit">
      <RBtn title="Undo the last document change (Ctrl+Z)" onMouseDown={customUndo}
        disabled={!canUndo} style={{fontSize:12,minWidth:55}}>↩ Undo</RBtn>
      <RBtn title="Redo the last undone change (Ctrl+Y)" onMouseDown={customRedo}
        disabled={!canRedo} style={{fontSize:12,minWidth:55}}>↪ Redo</RBtn>
      <RBtn title="Select content across every page" onMouseDown={selectAll}
        style={{fontSize:12,minWidth:80}}>☐ Select All</RBtn>
      <RBtn title="Clear the document (Undo can restore it)" onClick={clearAll}
        style={{fontSize:12,minWidth:70,color:"#c00"}}>🗑 Clear</RBtn>
    </RGroup>
    <RGroup label="Document">
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <span style={{fontSize:10,color:"#555",fontWeight:600}}>Title</span>
        <input value={docTitle} maxLength={120} aria-label="Document title"
          aria-invalid={titleIsEmpty}
          onChange={event=>onTitleChange(event.target.value)}
          onBlur={onTitleBlur}
          onKeyDown={event=>{
            if(event.key==="Enter"){
              event.preventDefault()
              event.currentTarget.blur()
              saveNow(false)
            }else if(event.key==="Escape"){
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          style={{border:`1px solid ${titleIsEmpty?"#c0392b":BORDER}`,borderRadius:4,
            padding:"4px 8px",fontSize:12,width:170,color:"#1a1a1a",outline:"none",
            background:titleIsEmpty?"#fff5f5":"#fff"}}/>
        <span style={{fontSize:9,color:titleIsEmpty||savedMsg.includes("✗")||savedMsg.includes("⚠")
          ?"#c0392b":"#777",height:10}}>
          {titleIsEmpty?"Title is required":savedMsg||"Ready to save"}
        </span>
      </div>
      <RBtn onClick={()=>saveNow(false)} disabled={saving||titleIsEmpty}
        title={titleIsEmpty?"Enter a title before saving":"Save document"}
        style={{fontSize:12,minWidth:70,marginLeft:4,
        background:saving?"#e8f5e9":"#f0f7ff",border:"1px solid #b0c8e8",fontWeight:600}}>
        {saving?"Saving…":"💾 Save"}
      </RBtn>
    </RGroup>
  </>)
}

function ViewRibbon({zoom,changeZoom,setViewZoom,readMode,enterReadMode,
  showNavigationPane,setShowNavigationPane,documentView,switchDocumentView}){
  return(<>
    <RGroup label="Views">
      <RBtn onClick={enterReadMode} active={readMode}
        title="Open a distraction-free reading view"
        style={{fontSize:11,minWidth:82}}>📖 Read Mode</RBtn>
      <RBtn onClick={()=>switchDocumentView("print")} active={documentView==="print"&&!readMode}
        title="Show printed A4 pages"
        style={{fontSize:11,minWidth:82}}>▤ Print Layout</RBtn>
      <RBtn onClick={()=>switchDocumentView("web")} active={documentView==="web"&&!readMode}
        title="Show the document as one continuous web view"
        style={{fontSize:11,minWidth:80}}>🌐 Web Layout</RBtn>
    </RGroup>
    <RGroup label="Show">
      <RBtn onClick={()=>setShowNavigationPane(value=>!value)} active={showNavigationPane}
        style={{fontSize:11,minWidth:104}}>☰ Navigation Pane</RBtn>
    </RGroup>
    <RGroup label="Zoom">
      <RBtn onClick={()=>changeZoom(.1)} style={{fontSize:16,minWidth:32}}>+</RBtn>
      <span style={{fontSize:13,minWidth:42,textAlign:"center",userSelect:"none"}}>{Math.round(zoom*100)}%</span>
      <RBtn onClick={()=>changeZoom(-.1)} style={{fontSize:16,minWidth:32}}>−</RBtn>
      <RBtn onClick={()=>setViewZoom(1)} style={{fontSize:12,minWidth:48}}>100%</RBtn>
    </RGroup>
    <RGroup label="Presets">
      {[50,75,100,125,150,200].map(percent=>(
        <RBtn key={percent} onClick={()=>setViewZoom(percent/100)}
          active={Math.round(zoom*100)===percent}
          style={{fontSize:11,minWidth:38}}>{percent}%</RBtn>
      ))}
    </RGroup>
  </>)
}

// ═══════════════════════════════════════════════════════════
//  COVER PAGE DIALOG
// ═══════════════════════════════════════════════════════════
let COVER_TEMPLATES = [
  
  {
    id:"classic", label:"Classic", preview:"#185abd",
    build:(t,s,a)=>`<div style="width:100%;min-height:900px;background:linear-gradient(160deg,#2b579a 0%,#1e3f6f 60%,#0d2040 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 60px;box-sizing:border-box;text-align:center;direction:rtl;">
      <div style="width:80px;height:4px;background:#e8a020;margin-bottom:40px;border-radius:2px;"></div>
      <h1 style="color:#fff;font-size:38px;font-weight:bold;margin:0 0 20px;line-height:1.3;">${t||"دستاویزُک ناو"}</h1>
      <div style="width:60px;height:2px;background:rgba(255,255,255,.3);margin:20px 0;"></div>
      <p style="color:rgba(255,255,255,.8);font-size:18px;margin:0 0 40px;">${s||"ذیلی عنوان"}</p>
      <p style="color:rgba(255,255,255,.6);font-size:14px;margin-top:60px;">${a||"مُصنِفُک ناو"}</p>
      <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:10px;">${new Date().toLocaleDateString("ur-PK",{year:"numeric",month:"long"})}</p>
      <div style="width:80px;height:4px;background:#e8a020;margin-top:40px;border-radius:2px;"></div>
    </div>`
  },
  {
    id:"modern", label:"Modern", preview:"#1a1a2e",
    build:(t,s,a)=>`<div style="width:100%;min-height:900px;background:#1a1a2e;display:flex;flex-direction:column;padding:0;box-sizing:border-box;direction:rtl;overflow:hidden;">
      <div style="background:#e63946;height:8px;"></div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;padding:80px 60px;">
        <h1 style="color:#fff;font-size:44px;font-weight:900;margin:0 0 16px;text-align:right;letter-spacing:-1px;">${t||"دستاویزُک عنوان"}</h1>
        <p style="color:#e63946;font-size:20px;margin:0 0 40px;text-align:right;">${s||"ذیلی عنوان"}</p>
        <div style="width:100%;height:1px;background:rgba(255,255,255,.1);margin:30px 0;"></div>
        <p style="color:rgba(255,255,255,.5);font-size:14px;text-align:right;">${a||"مُصنِفُک ناو"}</p>
      </div>
      <div style="background:#e63946;height:4px;"></div>
    </div>`
  },
  {
    id:"elegant", label:"Elegant", preview:"#f8f4f0",
    build:(t,s,a)=>`<div style="width:100%;min-height:900px;background:#f8f4f0;border:24px solid #2b579a;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;text-align:center;direction:rtl;">
      <div style="border:2px solid #2b579a;padding:40px 60px;width:100%;box-sizing:border-box;">
        <p style="color:#2b579a;font-size:12px;letter-spacing:4px;text-transform:uppercase;margin:0 0 24px;">دَستاویٖز</p>
        <h1 style="color:#1a1a1a;font-size:36px;font-weight:bold;margin:0 0 16px;border-bottom:2px solid #2b579a;padding-bottom:16px;">${t||"عنوان دستاویز"}</h1>
        <p style="color:#555;font-size:18px;margin:16px 0 40px;font-style:italic;">${s||"ذیلی عنوان"}</p>
        <p style="color:#333;font-size:14px;margin:0;">${a||"لٮ۪کھَنہار"}</p>
        <p style="color:#888;font-size:12px;margin-top:8px;">${new Date().toLocaleDateString("ur-PK",{year:"numeric",month:"long"})}</p>
      </div>
    </div>`
  },
  {
    id:"minimal", label:"Minimal", preview:"#ffffff",
    build:(t,s,a)=>`<div style="width:100%;min-height:900px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;box-sizing:border-box;text-align:center;direction:rtl;">
      <div style="width:40px;height:40px;background:#2b579a;border-radius:50%;margin-bottom:32px;"></div>
      <h1 style="color:#1a1a1a;font-size:40px;font-weight:300;letter-spacing:-1px;margin:0 0 16px;">${t||"دَستاویٖزُک سَرلکھ"}</h1>
      <p style="color:#666;font-size:16px;margin:0 0 60px;">${s||"ذیلی سَرلکھ"}</p>
      <p style="color:#999;font-size:13px;">${a||"لٮ۪کھَنہار"} · ${new Date().getFullYear()}</p>
    </div>`
  },
  {
    id:"academic", label:"Academic", preview:"#f4f7fb",
    build:(t,s,a)=>`<div style="width:100%;min-height:900px;background:#f4f7fb;box-sizing:border-box;padding:70px 64px;direction:rtl;display:flex;flex-direction:column;">
      <div style="height:12px;background:#185abd;margin-bottom:90px;"></div>
      <p style="font-size:13px;color:#185abd;font-weight:700;letter-spacing:2px;margin:0 0 18px;text-align:center;">ACADEMIC PROJECT</p>
      <h1 style="font-size:38px;line-height:1.35;color:#172b4d;text-align:center;margin:0 0 18px;">${t||"پروجیکٹُک عنوان"}</h1>
      <p style="font-size:18px;color:#5e6c84;text-align:center;margin:0;">${s||"ذیلی عنوان"}</p>
      <div style="margin-top:auto;border-top:1px solid #b8c6dc;padding-top:24px;text-align:center;color:#344563;font-size:14px;">${a||"طالب علم / لٮ۪کھَنہار"} · ${new Date().getFullYear()}</div>
    </div>`
  },
  {
    id:"heritage", label:"Kashmir Heritage", preview:"#0f6b5b",
    build:(t,s,a)=>`<div style="width:100%;min-height:900px;background:#fffaf0;box-sizing:border-box;padding:54px;direction:rtl;display:flex;align-items:center;justify-content:center;">
      <div style="width:100%;min-height:770px;border:6px double #0f6b5b;padding:64px 48px;box-sizing:border-box;text-align:center;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:42px;color:#b36b26;margin-bottom:28px;">❈</div>
        <h1 style="font-size:40px;color:#0f4f45;line-height:1.4;margin:0 0 18px;">${t||"کٲشُر دستاویز"}</h1>
        <p style="font-size:18px;color:#8a5524;margin:0 0 70px;">${s||"ذیلی سَرلکھ"}</p>
        <p style="font-size:14px;color:#4d5b57;margin:0;">${a||"لٮ۪کھَنہار"} · ${new Date().getFullYear()}</p>
      </div>
    </div>`
  },
  {
    id:"geometric", label:"Geometric", preview:"#6d28d9",
    build:(t,s,a)=>`<div style="width:100%;min-height:900px;background:#ffffff;box-sizing:border-box;direction:rtl;position:relative;overflow:hidden;padding:90px 64px;display:flex;flex-direction:column;justify-content:center;">
      <div style="position:absolute;top:-110px;left:-80px;width:330px;height:330px;background:#6d28d9;transform:rotate(35deg);"></div>
      <div style="position:absolute;bottom:-150px;right:-90px;width:360px;height:360px;border:40px solid #f59e0b;border-radius:50%;"></div>
      <div style="position:relative;z-index:1;background:rgba(255,255,255,.94);padding:48px;border-left:8px solid #6d28d9;">
        <h1 style="font-size:42px;color:#241442;line-height:1.3;margin:0 0 16px;">${t||"دستاویزُک عنوان"}</h1>
        <p style="font-size:18px;color:#6d28d9;margin:0 0 46px;">${s||"ذیلی عنوان"}</p>
        <p style="font-size:14px;color:#6b7280;margin:0;">${a||"مُصنِفُک ناو"} · ${new Date().getFullYear()}</p>
      </div>
    </div>`
  },
]
function CoverPageDialog({onInsert,onClose}){
  const [sel,setSel]=useState("classic")
  const [title,setTitle]=useState("")
  const [subtitle,setSubtitle]=useState("")
  const [author,setAuthor]=useState("")
  const tpl=COVER_TEMPLATES.find(t=>t.id===sel)||COVER_TEMPLATES[0]
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
      <div style={{background:"#fff",borderRadius:12,width:700,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)",overflow:"hidden"}}>
        <div style={{background:WORD_BLUE,color:"#fff",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:16}}>📄 Cover Page</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          {/* Left — templates */}
          <div style={{width:220,borderRight:`1px solid ${BORDER}`,padding:12,overflowY:"auto",flexShrink:0}}>
            <p style={{fontSize:11,fontWeight:700,color:"#555",margin:"0 0 8px",textTransform:"uppercase"}}>Templates</p>
            {COVER_TEMPLATES.map(t=>(
              <div key={t.id} onClick={()=>setSel(t.id)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,cursor:"pointer",marginBottom:6,
                  background:sel===t.id?"#e8f0fa":"transparent",border:sel===t.id?`1px solid ${WORD_BLUE}`:`1px solid transparent`}}>
                <div style={{width:36,height:50,borderRadius:4,background:t.preview,flexShrink:0,border:"1px solid #ddd"}}/>
                <span style={{fontSize:13,fontWeight:sel===t.id?700:400,color:sel===t.id?WORD_BLUE:"#333"}}>{t.label}</span>
              </div>
            ))}
          </div>
          {/* Right — fields + preview */}
          <div style={{flex:1,padding:20,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
            <p style={{fontSize:11,fontWeight:700,color:"#555",margin:"0 0 4px",textTransform:"uppercase"}}>Customize</p>
            {[["عنوان (Title)",title,setTitle,"Main document title"],["ذیلی سَرلکھ (Subtitle)",subtitle,setSubtitle,"Optional subtitle"],["لٮ۪کھَنہار (Author)",author,setAuthor,"Author name"]].map(([lbl,val,setter,ph])=>(
              <div key={lbl}>
                <label style={{fontSize:12,color:"#666",display:"block",marginBottom:4}}>{lbl}</label>
                <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
                  style={{width:"100%",padding:"8px 12px",border:`1px solid ${BORDER}`,borderRadius:6,fontSize:13,boxSizing:"border-box",direction:"rtl",fontFamily:"inherit"}}/>
              </div>
            ))}
            <div style={{marginTop:8,padding:12,background:"#f5f5f5",borderRadius:8,fontSize:11,color:"#666"}}>
              ℹ️ The cover page will be inserted at the beginning of your document as a separate page.
            </div>
          </div>
        </div>
        <div style={{padding:"12px 20px",borderTop:`1px solid ${BORDER}`,display:"flex",justifyContent:"flex-end",gap:10,flexShrink:0}}>
          <button onClick={onClose} style={{padding:"8px 20px",border:`1px solid ${BORDER}`,borderRadius:6,background:"#fff",cursor:"pointer",fontSize:13}}>Cancel</button>
          <button onClick={()=>{onInsert(tpl.build(title,subtitle,author));onClose()}}
            style={{padding:"8px 20px",border:"none",borderRadius:6,background:WORD_BLUE,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>
            ✓ Insert Cover Page
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  WORDART DIALOG
// ═══════════════════════════════════════════════════════════
const WORDART_STYLES=[
  {id:"shadow",   label:"Shadow",   css:"font-size:48px;font-weight:900;color:#2b579a;text-shadow:4px 4px 0 rgba(0,0,0,.2);"},
  {id:"outline",  label:"Outline",  css:"font-size:48px;font-weight:900;color:transparent;-webkit-text-stroke:2px #2b579a;"},
  {id:"gradient", label:"Gradient", css:"font-size:48px;font-weight:900;background:linear-gradient(135deg,#2b579a,#e8a020);-webkit-background-clip:text;-webkit-text-fill-color:transparent;"},
  {id:"3d",       label:"3D",       css:"font-size:48px;font-weight:900;color:#fff;text-shadow:1px 1px 0 #1a3a6c,2px 2px 0 #1a3a6c,3px 3px 0 #1a3a6c,4px 4px 6px rgba(0,0,0,.4);"},
  {id:"glow",     label:"Glow",     css:"font-size:48px;font-weight:900;color:#2b579a;text-shadow:0 0 10px #6af,0 0 24px #8af,0 0 40px #adf;"},
  {id:"rainbow",  label:"Rainbow",  css:"font-size:48px;font-weight:900;background:linear-gradient(90deg,#e74c3c,#e8a020,#27ae60,#2b579a,#8e44ad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;"},
]
function WordArtDialog({onInsert,onClose}){
  const [text,setText]=useState("کشمیر")
  const [selStyle,setSelStyle]=useState("shadow")
  const ws=WORDART_STYLES.find(s=>s.id===selStyle)||WORDART_STYLES[0]
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
      <div style={{background:"#fff",borderRadius:12,width:580,boxShadow:"0 16px 48px rgba(0,0,0,.3)",overflow:"hidden"}}>
        <div style={{background:WORD_BLUE,color:"#fff",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700,fontSize:16}}>🅐 WordArt</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:24}}>
          <label style={{fontSize:12,color:"#555",fontWeight:600}}>Text</label>
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Enter text…"
            style={{width:"100%",padding:"10px 14px",border:`1px solid ${BORDER}`,borderRadius:8,fontSize:18,marginTop:6,marginBottom:20,boxSizing:"border-box",direction:"rtl",fontFamily:"inherit"}}/>
          <p style={{fontSize:12,color:"#555",fontWeight:600,margin:"0 0 10px"}}>Style</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
            {WORDART_STYLES.map(s=>(
              <div key={s.id} onClick={()=>setSelStyle(s.id)}
                style={{padding:"12px 8px",borderRadius:8,border:selStyle===s.id?`2px solid ${WORD_BLUE}`:"1px solid #ddd",
                  cursor:"pointer",textAlign:"center",background:selStyle===s.id?"#e8f0fa":"#f8f8f8",overflow:"hidden"}}>
                <span style={{...Object.fromEntries(s.css.split(";").filter(Boolean).map(r=>{const[k,...v]=r.split(":");return[k.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v.join(":").trim()]})),fontSize:"22px"}}>أ</span>
                <p style={{fontSize:10,color:"#555",margin:"4px 0 0"}}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* Preview */}
          <div style={{padding:20,background:"#f0f0f0",borderRadius:8,textAlign:"center",minHeight:80,display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl",marginBottom:16}}>
            <span style={{...Object.fromEntries(ws.css.split(";").filter(Boolean).map(r=>{const[k,...v]=r.split(":");return[k.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v.join(":").trim()]}))}}>{text||"نمونہ"}</span>
          </div>
        </div>
        <div style={{padding:"12px 24px",borderTop:`1px solid ${BORDER}`,display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{padding:"8px 20px",border:`1px solid ${BORDER}`,borderRadius:6,background:"#fff",cursor:"pointer",fontSize:13}}>Cancel</button>
          <button onClick={()=>{
            const html=`<div contenteditable="false" style="display:inline-block;margin:8px;direction:rtl;${ws.css}">${text}</div><p></p>`
            onInsert(html);onClose()
          }} style={{padding:"8px 20px",border:"none",borderRadius:6,background:WORD_BLUE,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>
            ✓ Insert WordArt
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 1: LIVE EDITABLE CHART DIALOG (Chart.js)
// ═══════════════════════════════════════════════════════════
function buildDynamicChartSVG({chartType,labels,values,colors,title,legend},width=520,height=320){
  const safe=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))
  const nums=values.map(value=>Number(value)||0),max=Math.max(1,...nums.map(Math.abs))
  const palette=labels.map((_,index)=>colors[index]||"#2b579a")
  const top=title?40:18,left=52,right=legend?122:24,bottom=48
  const plotW=width-left-right,plotH=height-top-bottom
  const parts=[`<rect width="${width}" height="${height}" fill="white"/>`]
  if(title)parts.push(`<text x="${width/2}" y="25" text-anchor="middle" font-family="Segoe UI,Arial" font-size="17" font-weight="600" fill="#222">${safe(title)}</text>`)
  const addLegend=()=>{
    if(!legend)return
    labels.forEach((label,index)=>{
      const y=top+14+index*22
      if(y>height-12)return
      parts.push(`<rect x="${width-right+12}" y="${y-10}" width="11" height="11" rx="2" fill="${palette[index]}"/>`)
      parts.push(`<text x="${width-right+29}" y="${y}" font-family="Segoe UI,Arial" font-size="11" fill="#444">${safe(label).slice(0,14)}</text>`)
    })
  }
  if(["pie","doughnut","polarArea"].includes(chartType)){
    const cx=left+plotW/2,cy=top+plotH/2,r=Math.min(plotW,plotH)*.4,total=Math.max(1,nums.reduce((sum,value)=>sum+Math.abs(value),0))
    let angle=-Math.PI/2
    nums.forEach((value,index)=>{
      const portion=Math.abs(value)/total,end=angle+portion*Math.PI*2
      const radius=chartType==="polarArea"?r*(.35+.65*Math.abs(value)/max):r
      const x1=cx+Math.cos(angle)*radius,y1=cy+Math.sin(angle)*radius
      const x2=cx+Math.cos(end)*radius,y2=cy+Math.sin(end)*radius
      const large=end-angle>Math.PI?1:0
      parts.push(`<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z" fill="${palette[index]}" stroke="#fff" stroke-width="2"/>`)
      angle=end
    })
    if(chartType==="doughnut")parts.push(`<circle cx="${cx}" cy="${cy}" r="${r*.5}" fill="#fff"/>`)
    addLegend()
  }else if(chartType==="radar"){
    const cx=left+plotW/2,cy=top+plotH/2,r=Math.min(plotW,plotH)*.4,count=Math.max(3,labels.length)
    for(let ring=1;ring<=4;ring++){
      const points=Array.from({length:count},(_,index)=>{const a=-Math.PI/2+index*Math.PI*2/count;return `${cx+Math.cos(a)*r*ring/4},${cy+Math.sin(a)*r*ring/4}`}).join(" ")
      parts.push(`<polygon points="${points}" fill="none" stroke="#d8d8d8"/>`)
    }
    const dataPoints=Array.from({length:count},(_,index)=>{const a=-Math.PI/2+index*Math.PI*2/count,rr=r*(Math.abs(nums[index]||0)/max);return `${cx+Math.cos(a)*rr},${cy+Math.sin(a)*rr}`}).join(" ")
    parts.push(`<polygon points="${dataPoints}" fill="#2b579a44" stroke="#2b579a" stroke-width="2"/>`)
    labels.forEach((label,index)=>{const a=-Math.PI/2+index*Math.PI*2/count;parts.push(`<text x="${cx+Math.cos(a)*(r+18)}" y="${cy+Math.sin(a)*(r+18)}" text-anchor="middle" font-family="Segoe UI,Arial" font-size="10">${safe(label)}</text>`)})
    addLegend()
  }else if(chartType==="horizontalBar"){
    const gap=plotH/Math.max(1,labels.length),barH=Math.max(8,gap*.58)
    parts.push(`<line x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}" stroke="#777"/>`)
    nums.forEach((value,index)=>{
      const y=top+index*gap+(gap-barH)/2,w=Math.max(1,Math.abs(value)/max*plotW)
      parts.push(`<rect x="${left}" y="${y}" width="${w}" height="${barH}" rx="2" fill="${palette[index]}"/>`)
      parts.push(`<text x="${left-7}" y="${y+barH*.7}" text-anchor="end" font-family="Segoe UI,Arial" font-size="10">${safe(labels[index])}</text>`)
    })
    addLegend()
  }else{
    parts.push(`<line x1="${left}" y1="${top+plotH}" x2="${left+plotW}" y2="${top+plotH}" stroke="#777"/><line x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}" stroke="#777"/>`)
    for(let grid=0;grid<=4;grid++){const y=top+plotH-grid*plotH/4;parts.push(`<line x1="${left}" y1="${y}" x2="${left+plotW}" y2="${y}" stroke="#e5e5e5"/><text x="${left-7}" y="${y+4}" text-anchor="end" font-family="Segoe UI,Arial" font-size="9" fill="#777">${Math.round(max*grid/4)}</text>`)}
    const step=plotW/Math.max(1,labels.length)
    if(chartType==="bar"){
      nums.forEach((value,index)=>{const h=Math.abs(value)/max*plotH,x=left+index*step+step*.18,y=top+plotH-h;parts.push(`<rect x="${x}" y="${y}" width="${step*.64}" height="${h}" rx="2" fill="${palette[index]}"/>`)})
    }else{
      const points=nums.map((value,index)=>`${left+step*(index+.5)},${top+plotH-Math.abs(value)/max*plotH}`).join(" ")
      if(chartType==="line")parts.push(`<polyline points="${points}" fill="none" stroke="#2b579a" stroke-width="3"/>`)
      nums.forEach((value,index)=>{const x=left+step*(index+.5),y=top+plotH-Math.abs(value)/max*plotH;parts.push(`<circle cx="${x}" cy="${y}" r="${chartType==="scatter"?6:4}" fill="${palette[index]}" stroke="#fff" stroke-width="1.5"/>`)})
    }
    labels.forEach((label,index)=>parts.push(`<text x="${left+step*(index+.5)}" y="${top+plotH+18}" text-anchor="middle" font-family="Segoe UI,Arial" font-size="10">${safe(label).slice(0,10)}</text>`))
    addLegend()
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${parts.join("")}</svg>`
}

function ChartEditorDialog({ onInsert, onClose, initialData=null }) {
  const [chartType, setChartType] = useState(initialData?.chartType||"bar")
  const [labels, setLabels] = useState(initialData?.labels||["Jan","Feb","Mar","Apr","May"])
  const [values, setValues] = useState(initialData?.values||[60,90,50,75,85])
  const [colors, setColors] = useState(initialData?.colors||["#2b579a","#e8a020","#27ae60","#c0392b","#8e44ad"])
  const [title,  setTitle]  = useState(initialData?.title??"My Chart")
  const [legend, setLegend] = useState(initialData?.legend??true)
  const chartSvg=buildDynamicChartSVG({chartType,labels,values,colors,title,legend})

  function addRow() {
    setLabels(l => [...l, "New"])
    setValues(v => [...v, 50])
    setColors(c => [...c, "#" + Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,"0")])
  }
  function removeRow(i) {
    setLabels(l => l.filter((_,x)=>x!==i))
    setValues(v => v.filter((_,x)=>x!==i))
    setColors(c => c.filter((_,x)=>x!==i))
  }

  function handleInsert() {
    const img=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(chartSvg)}`
    // Embed as image with data-chart for future editing
    const meta = JSON.stringify({ chartType, labels, values, colors, title, legend })
    onInsert(img, meta)
    onClose()
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999 }}>
      <div style={{ background:"#fff",borderRadius:12,width:820,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)",overflow:"hidden" }}>
        {/* Header */}
        <div style={{ background:WORD_BLUE,color:"#fff",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
          <span style={{ fontWeight:700,fontSize:16 }}>📊 Chart Editor</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer" }}>×</button>
        </div>
        <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
          {/* Left — controls */}
          <div style={{ width:300,padding:16,borderRight:`1px solid ${BORDER}`,overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column",gap:12 }}>
            {/* Chart type */}
            <div>
              <label style={{ fontSize:12,fontWeight:600,color:"#555",display:"block",marginBottom:4 }}>Chart Type</label>
              <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                {[["bar","▥ Column"],["horizontalBar","▤ Bar"],["pie","◕ Pie"],["line","📈 Line"],["doughnut","🍩 Donut"],["polarArea","🎯 Polar"],["radar","🕸 Radar"],["scatter","⚡ Scatter"]].map(([t,l])=>(
                  <button key={t} onClick={()=>setChartType(t)}
                    style={{ padding:"4px 8px",border:`2px solid ${chartType===t?WORD_BLUE:BORDER}`,borderRadius:6,background:chartType===t?"#dce6f5":"#fff",cursor:"pointer",fontSize:10,fontWeight:chartType===t?700:400,whiteSpace:"nowrap" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {/* Title */}
            <div>
              <label style={{ fontSize:12,fontWeight:600,color:"#555",display:"block",marginBottom:4 }}>Rename Chart</label>
              <input value={title} onChange={e=>setTitle(e.target.value)}
                style={{ width:"100%",padding:"6px 8px",border:`1px solid ${BORDER}`,borderRadius:4,fontSize:13,boxSizing:"border-box" }}/>
            </div>
            {/* Legend toggle */}
            <label style={{ display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer" }}>
              <input type="checkbox" checked={legend} onChange={e=>setLegend(e.target.checked)}/> Show Legend
            </label>
            {/* Data rows */}
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                <label style={{ fontSize:12,fontWeight:600,color:"#555" }}>Data</label>
                <button onClick={addRow} style={{ fontSize:12,padding:"3px 10px",border:`1px solid ${WORD_BLUE}`,borderRadius:4,color:WORD_BLUE,background:"#fff",cursor:"pointer",fontWeight:600 }}>+ Add Row</button>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:5,maxHeight:220,overflowY:"auto" }}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 28px 26px",gap:5,fontSize:10,fontWeight:700,color:"#666",padding:"0 2px"}}>
                  <span>Category Name</span><span>Value</span><span>Color</span><span/>
                </div>
                {labels.map((lbl,i)=>(
                  <div key={i} style={{ display:"flex",gap:5,alignItems:"center" }}>
                    <input value={lbl} onChange={e=>{const a=[...labels];a[i]=e.target.value;setLabels(a)}}
                      placeholder="Label" style={{ flex:2,padding:"4px 6px",border:`1px solid ${BORDER}`,borderRadius:4,fontSize:12 }}/>
                    <input type="number" value={values[i]} onChange={e=>{const a=[...values];a[i]=parseFloat(e.target.value)||0;setValues(a)}}
                      style={{ flex:1,padding:"4px 6px",border:`1px solid ${BORDER}`,borderRadius:4,fontSize:12 }}/>
                    <input type="color" value={colors[i]} onChange={e=>{const a=[...colors];a[i]=e.target.value;setColors(a)}}
                      style={{ width:28,height:28,padding:1,border:`1px solid ${BORDER}`,borderRadius:3,cursor:"pointer" }}/>
                    <button onClick={()=>removeRow(i)} style={{ background:"#fee",border:`1px solid #fcc`,borderRadius:4,color:"#c00",cursor:"pointer",padding:"3px 6px",fontSize:12 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Right — preview */}
          <div style={{ flex:1,padding:20,display:"flex",flexDirection:"column",gap:12,background:"#f9f9f9",overflow:"auto" }}>
            <div style={{ fontWeight:600,fontSize:13,color:"#555" }}>Preview</div>
            <div style={{ background:"#fff",borderRadius:8,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,.08)",flex:1,display:"flex",alignItems:"center",justifyContent:"center" }}>
              <div style={{width:"100%",maxWidth:520,lineHeight:0}} dangerouslySetInnerHTML={{__html:chartSvg}}/>
            </div>
            <button onClick={handleInsert}
              style={{ background:WORD_BLUE,color:"#fff",border:"none",borderRadius:8,padding:"10px 0",fontSize:14,fontWeight:600,cursor:"pointer",width:"100%" }}>
              {initialData?"✓ Update Chart":"📊 Insert Chart into Document"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 2: TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════
function TableOfContents({ pagesRef, onClose, onInsert }) {
  const [headings,setHeadings]=useState([])
  const [levels,setLevels]=useState(3)
  const [tocStyle,setTocStyle]=useState("classic")
  const [showPageNumbers,setShowPageNumbers]=useState(true)
  const [existingTOC,setExistingTOC]=useState(false)

  function scanHeadings(){
    const found = []
    pagesRef.current.filter(Boolean).forEach((pg, pi) => {
      // In the Home styles gallery H1 is Title; Word TOCs use Heading 1–3,
      // represented here by H2, H3 and H4.
      pg.querySelectorAll("h2,h3,h4").forEach((el,headingIndex) => {
        const level=parseInt(el.tagName.slice(1),10)-1
        const text=(el.innerText||"").replace(/\u200B/g,"").trim()
        if(!text)return
        if(!el.id||!el.id.startsWith("word_toc_heading_")){
          el.id=`word_toc_heading_${pi+1}_${headingIndex+1}_${Date.now().toString(36)}`
        }
        found.push({level,text,id:el.id,page:pi+1})
      })
    })
    setHeadings(found)
    setExistingTOC(pagesRef.current.some(page=>page?.querySelector('[data-word-toc="true"]')))
  }
  useEffect(()=>{scanHeadings()},[])

  const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[char]))

  function buildTOCHTML() {
    const visible=headings.filter(heading=>heading.level<=levels)
    if(!visible.length)return ""
    const styles={
      classic:{border:"1px solid #b7b7b7",background:"#fff",titleColor:"#1a1a1a",accent:"#1a1a1a"},
      modern:{border:"none",background:"#f3f7fb",titleColor:"#2b579a",accent:"#2b579a"},
      simple:{border:"none",background:"transparent",titleColor:"#1a1a1a",accent:"#444"},
    }
    const selected=styles[tocStyle]||styles.classic
    let html=`<div data-word-toc="true" data-toc-style="${tocStyle}" data-toc-levels="${levels}"
      contenteditable="false" style="border:${selected.border};padding:16px 18px;margin:12px 0;
      background:${selected.background};font-family:inherit;direction:rtl;box-sizing:border-box;">
      <div style="font-weight:700;font-size:18px;color:${selected.titleColor};
        border-bottom:${tocStyle==="modern"?"3px":"1px"} solid ${selected.accent};
        padding-bottom:7px;margin-bottom:10px;">Table of Contents</div>`
    visible.forEach(heading=>{
      const indent=(heading.level-1)*22
      html+=`<a href="#${escapeHTML(heading.id)}" data-toc-link="${escapeHTML(heading.id)}"
        style="display:flex;align-items:flex-end;gap:7px;margin:5px 0;padding-right:${indent}px;
        color:${selected.accent};text-decoration:none;cursor:pointer;font-size:${heading.level===1?14:13}px;
        font-weight:${heading.level===1?600:400};direction:rtl;">
        <span>${escapeHTML(heading.text)}</span>
        ${showPageNumbers?`<span style="flex:1;border-bottom:1px dotted #888;transform:translateY(-4px);"></span>
        <span style="min-width:20px;text-align:left;color:#555;">${heading.page}</span>`:""}
      </a>`
    })
    html+="</div>"
    return html
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999 }}>
      <div style={{ background:"#fff",borderRadius:12,width:480,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.3)",overflow:"hidden" }}>
        <div style={{ background:WORD_BLUE,color:"#fff",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span style={{ fontWeight:700,fontSize:15 }}>📑 Table of Contents</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer" }}>×</button>
        </div>
        <div style={{padding:16,flex:1,overflowY:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <label style={{fontSize:11,color:"#555"}}>Built-in format
              <select value={tocStyle} onChange={event=>setTocStyle(event.target.value)}
                style={{display:"block",width:"100%",marginTop:4,padding:"6px",border:`1px solid ${BORDER}`,borderRadius:4}}>
                <option value="classic">Classic</option>
                <option value="modern">Modern</option>
                <option value="simple">Simple</option>
              </select>
            </label>
            <label style={{fontSize:11,color:"#555"}}>Show levels
              <select value={levels} onChange={event=>setLevels(Number(event.target.value))}
                style={{display:"block",width:"100%",marginTop:4,padding:"6px",border:`1px solid ${BORDER}`,borderRadius:4}}>
                <option value={1}>Heading 1 only</option>
                <option value={2}>Heading 1–2</option>
                <option value={3}>Heading 1–3</option>
              </select>
            </label>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#444",marginBottom:10}}>
            <input type="checkbox" checked={showPageNumbers} onChange={event=>setShowPageNumbers(event.target.checked)}/>
            Show page numbers with dotted leaders
          </label>
          {headings.length === 0
            ? <div style={{ textAlign:"center",padding:32,color:"#888" }}>
                <div style={{ fontSize:32,marginBottom:8 }}>📄</div>
                <p>No headings found in document.</p>
                <p style={{ fontSize:12,color:"#aaa" }}>Apply Heading 1, Heading 2, or Heading 3 from Home → Styles.</p>
              </div>
            : <>
                <p style={{fontSize:12,color:"#888",marginBottom:8}}>
                  Found {headings.length} headings. Entries are clickable and use the page where each heading appears.
                </p>
                {headings.filter(heading=>heading.level<=levels).map((h,i) => (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 0",paddingRight:(h.level-1)*18,borderBottom:`1px solid #f0f0f0` }}>
                    <span style={{ fontSize:10,background:h.level===1?"#2b579a":h.level===2?"#27ae60":"#888",color:"#fff",borderRadius:3,padding:"1px 5px",flexShrink:0 }}>H{h.level}</span>
                    <span style={{ flex:1,fontSize:13 }}>{h.text}</span>
                    <span style={{ fontSize:11,color:"#aaa" }}>pg {h.page}</span>
                  </div>
                ))}
              </>
          }
        </div>
        <div style={{padding:12,borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={scanHeadings}
            style={{padding:"8px 12px",border:`1px solid ${BORDER}`,borderRadius:6,background:"#fff",cursor:"pointer",fontSize:12}}>↻ Rescan</button>
          <button onClick={onClose} style={{padding:"8px 12px",border:`1px solid ${BORDER}`,borderRadius:6,background:"#fff",cursor:"pointer",fontSize:12}}>Cancel</button>
          {existingTOC&&<button onClick={()=>{const html=buildTOCHTML();if(html){onInsert(html,true);onClose()}}} disabled={!headings.length}
            style={{flex:1,padding:"8px 10px",border:`1px solid ${WORD_BLUE}`,borderRadius:6,background:"#fff",color:WORD_BLUE,cursor:headings.length?"pointer":"default",fontSize:12,fontWeight:600}}>
            ↻ Update Existing
          </button>}
          <button onClick={()=>{const html=buildTOCHTML();if(html){onInsert(html,false);onClose()}}} disabled={!headings.length}
            style={{flex:1.4,padding:"8px 10px",border:"none",borderRadius:6,background:headings.length?WORD_BLUE:"#ccc",color:"#fff",cursor:headings.length?"pointer":"default",fontSize:12,fontWeight:600}}>
            📑 Insert Table
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 3: COMMENTS RIBBON + SIDEBAR
// ═══════════════════════════════════════════════════════════
function CommentsRibbon({addComment,showComments,setShowComments,comments,trackChanges,
  toggleTrackChanges,changes,acceptAllChanges,rejectAllChanges}) {
  const openComments=comments.filter(comment=>!comment.resolved).length
  return (
    <>
      <RGroup label="New Comment">
        <RBtn onClick={addComment} style={{ fontSize:12,minWidth:110,background:"#fff0b3",border:"1px solid #e8a020" }}>💬 Add Comment</RBtn>
      </RGroup>
      <RGroup label="Comments Panel">
        <RBtn onClick={()=>setShowComments(v=>!v)} active={showComments} style={{ fontSize:12,minWidth:110 }}>
          {showComments ? "Hide Comments" : "📋 Show Comments"}
        </RBtn>
        <span style={{fontSize:11,color:"#888",padding:"0 6px"}}>
          {openComments} open · {comments.length} total
        </span>
      </RGroup>
      <RGroup label="Track Changes">
        <RBtn onClick={toggleTrackChanges} active={trackChanges}
          style={{ fontSize:12,minWidth:120,background:trackChanges?"#e8f1ff":"transparent",border:trackChanges?`1px solid ${WORD_BLUE}`:"1px solid transparent" }}>
          {trackChanges ? "🔵 Tracking ON" : "🔵 Track Changes"}
        </RBtn>
        <span style={{fontSize:10,color:"#777",padding:"0 5px"}}>
          {changes.length} pending change{changes.length===1?"":"s"}
        </span>
      </RGroup>
      <RGroup label="Changes">
        <RBtn onClick={acceptAllChanges} disabled={!changes.length}
          title="Keep insertions and permanently remove deletions"
          style={{fontSize:11,minWidth:82,color:"#1d7a3a"}}>✓ Accept All</RBtn>
        <RBtn onClick={rejectAllChanges} disabled={!changes.length}
          title="Remove insertions and restore deleted text"
          style={{fontSize:11,minWidth:82,color:"#b42318"}}>✕ Reject All</RBtn>
      </RGroup>
    </>
  )
}

function CommentsSidebar({comments,resolveComment,deleteComment,onClose,activeCommentId,setActiveCommentId}) {
  function scrollToComment(id) {
    const anchor=document.querySelector(`[data-comment-id="${id}"]`)
    anchor?.scrollIntoView({behavior:"smooth",block:"center"})
    setActiveCommentId(id)
  }
  return (
    <div style={{ width:280,background:"#fff",borderLeft:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
      <div style={{ background:WORD_BLUE,color:"#fff",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
        <span style={{ fontWeight:600,fontSize:13 }}>💬 Comments ({comments.length})</span>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer" }}>×</button>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:10,display:"flex",flexDirection:"column",gap:8 }}>
        {comments.length===0
          ? <div style={{ textAlign:"center",padding:32,color:"#aaa" }}>
              <div style={{ fontSize:28 }}>💬</div>
              <p style={{ fontSize:12,marginTop:8 }}>No comments yet.<br/>Select text and click Add Comment.</p>
            </div>
          : comments.map(c => (
            <div key={c.id} onClick={()=>setActiveCommentId(c.id)}
              style={{border:`${activeCommentId===c.id?2:1}px solid ${activeCommentId===c.id?WORD_BLUE:c.resolved?"#ddd":BORDER}`,
                borderRadius:8,padding:10,opacity:c.resolved ? .65 : 1,
                background:c.resolved?"#f9f9f9":activeCommentId===c.id?"#f4f8fd":"#fff"}}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                <span style={{ fontSize:11,fontWeight:600,color:WORD_BLUE }}>💬 {c.author||"You"}</span>
                <span style={{ fontSize:10,color:"#aaa" }}>{new Date(c.time).toLocaleTimeString()}</span>
              </div>
              {c.selectedText && <div style={{ fontSize:11,color:"#888",background:"#f5f5f5",padding:"2px 6px",borderRadius:3,marginBottom:6,fontStyle:"italic" }}>"{c.selectedText.slice(0,60)}{c.selectedText.length>60?"…":""}"</div>}
              <p style={{ fontSize:13,color:"#333",margin:"4px 0 8px",lineHeight:1.5 }}>{c.text}</p>
              <div style={{ display:"flex",gap:6 }}>
                <button onClick={()=>scrollToComment(c.id)} style={{ fontSize:11,padding:"2px 8px",border:`1px solid ${BORDER}`,borderRadius:4,background:"#fff",cursor:"pointer" }}>Go to</button>
                {!c.resolved
                  ? <button onClick={()=>resolveComment(c.id)} style={{ fontSize:11,padding:"2px 8px",border:"1px solid #27ae60",borderRadius:4,color:"#27ae60",background:"#fff",cursor:"pointer" }}>✓ Resolve</button>
                  : <button onClick={()=>resolveComment(c.id)} style={{fontSize:11,padding:"2px 8px",border:"1px solid #888",borderRadius:4,color:"#666",background:"#fff",cursor:"pointer"}}>↺ Reopen</button>}
                <button onClick={()=>deleteComment(c.id)} style={{ fontSize:11,padding:"2px 8px",border:"1px solid #e74c3c",borderRadius:4,color:"#e74c3c",background:"#fff",cursor:"pointer",marginLeft:"auto" }}>Delete</button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  FEATURE 4: IMAGE EDITOR DIALOG
// ═══════════════════════════════════════════════════════════
function ImageEditorDialog({ src, onSave, onClose }) {
  const canvasRef = useRef(null)
  const [brightness, setBrightness] = useState(100)
  const [contrast,   setContrast]   = useState(100)
  const [saturate,   setSaturate]   = useState(100)
  const [blur,       setBlur]       = useState(0)
  const [borderW,    setBorderW]    = useState(0)
  const [borderColor,setBorderColor]= useState("#2b579a")
  const [borderRadius,setBorderRadius]=useState(0)
  const [shadow,     setShadow]     = useState(false)
  const [wrap,       setWrap]       = useState("none")
  const [crop,       setCrop]       = useState({top:0,right:0,bottom:0,left:0})
  const imgRef = useRef(null)

  const filterCSS = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) blur(${blur}px)`
  const boxShadow = shadow ? "4px 4px 16px rgba(0,0,0,0.35)" : "none"
  const border    = borderW > 0 ? `${borderW}px solid ${borderColor}` : "none"

  function handleSave() {
    // Build final style string and return
    const style = [
      `filter:${filterCSS}`,
      borderW>0?`border:${border}`:"",
      `border-radius:${borderRadius}px`,
      shadow?`box-shadow:${boxShadow}`:"",
      `clip-path:inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`,
      wrap!=="none"?`float:${wrap};margin:${wrap==="left"?"0 12px 8px 0":"0 0 8px 12px"}`:"display:block;margin:8px auto",
    ].filter(Boolean).join(";")
    onSave(style)
    onClose()
  }

  const sliders = [
    ["Brightness", brightness, setBrightness, 0, 200, "☀️"],
    ["Contrast",   contrast,   setContrast,   0, 200, "◑"],
    ["Saturation", saturate,   setSaturate,   0, 200, "🎨"],
    ["Blur",       blur,       setBlur,       0, 10,  "🌫"],
  ]

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999 }}>
      <div style={{ background:"#fff",borderRadius:12,width:800,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 16px 48px rgba(0,0,0,.4)",overflow:"hidden" }}>
        <div style={{ background:WORD_BLUE,color:"#fff",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
          <span style={{ fontWeight:700,fontSize:15 }}>🖼 Image Editor</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer" }}>×</button>
        </div>
        <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
          {/* Controls */}
          <div style={{ width:260,padding:16,borderRight:`1px solid ${BORDER}`,overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column",gap:14 }}>
            {/* Adjustments */}
            <div>
              <p style={{ fontWeight:700,fontSize:12,color:"#555",marginBottom:8,textTransform:"uppercase",letterSpacing:.5 }}>Adjustments</p>
              {sliders.map(([label,val,set,min,max,icon])=>(
                <div key={label} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3 }}>
                    <span>{icon} {label}</span><span style={{ color:"#888" }}>{val}{label==="Blur"?"px":"%"}</span>
                  </div>
                  <input type="range" min={min} max={max} value={val} onChange={e=>set(parseInt(e.target.value))} style={{ width:"100%" }}/>
                </div>
              ))}
              <button onClick={()=>{setBrightness(100);setContrast(100);setSaturate(100);setBlur(0)}}
                style={{ fontSize:11,padding:"4px 0",width:"100%",border:`1px solid ${BORDER}`,borderRadius:4,background:"#fff",cursor:"pointer" }}>
                ↺ Reset Adjustments
              </button>
            </div>
            {/* Border */}
            <div>
              <p style={{ fontWeight:700,fontSize:12,color:"#555",marginBottom:8,textTransform:"uppercase",letterSpacing:.5 }}>Border & Shape</p>
              <div style={{ display:"flex",gap:8,marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:11,color:"#777" }}>Border Width</label>
                  <input type="number" min={0} max={20} value={borderW} onChange={e=>setBorderW(parseInt(e.target.value)||0)}
                    style={{ width:"100%",padding:"4px 6px",border:`1px solid ${BORDER}`,borderRadius:4,fontSize:12,marginTop:2 }}/>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:11,color:"#777" }}>Color</label>
                  <input type="color" value={borderColor} onChange={e=>setBorderColor(e.target.value)}
                    style={{ width:"100%",height:28,padding:1,border:`1px solid ${BORDER}`,borderRadius:4,marginTop:2,cursor:"pointer" }}/>
                </div>
              </div>
              <div>
                <label style={{ fontSize:11,color:"#777" }}>Border Radius (px)</label>
                <input type="range" min={0} max={100} value={borderRadius} onChange={e=>setBorderRadius(parseInt(e.target.value))} style={{ width:"100%",marginTop:4 }}/>
                <span style={{ fontSize:11,color:"#888" }}>{borderRadius}px</span>
              </div>
            </div>
            <div>
              <p style={{fontWeight:700,fontSize:12,color:"#555",marginBottom:7,textTransform:"uppercase",letterSpacing:.5}}>Crop</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[["top","Top"],["right","Right"],["bottom","Bottom"],["left","Left"]].map(([side,label])=>(
                  <label key={side} style={{fontSize:10,color:"#666"}}>{label}
                    <input type="range" min={0} max={45} value={crop[side]}
                      onChange={event=>setCrop(current=>({...current,[side]:parseInt(event.target.value)}))}
                      style={{width:"100%"}}/>
                  </label>
                ))}
              </div>
              <button onClick={()=>setCrop({top:0,right:0,bottom:0,left:0})}
                style={{fontSize:11,padding:"4px 0",width:"100%",border:`1px solid ${BORDER}`,borderRadius:4,background:"#fff",cursor:"pointer"}}>Reset Crop</button>
            </div>
            {/* Shadow */}
            <label style={{ display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",fontWeight:500 }}>
              <input type="checkbox" checked={shadow} onChange={e=>setShadow(e.target.checked)}/> 🌑 Drop Shadow
            </label>
            {/* Text wrap */}
            <div>
              <p style={{ fontWeight:700,fontSize:12,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Text Wrap</p>
              <div style={{ display:"flex",gap:5 }}>
                {[["none","No wrap"],["left","Wrap Left"],["right","Wrap Right"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setWrap(v)}
                    style={{ flex:1,padding:"5px 2px",border:`2px solid ${wrap===v?WORD_BLUE:BORDER}`,borderRadius:5,background:wrap===v?"#dce6f5":"#fff",cursor:"pointer",fontSize:10,fontWeight:wrap===v?700:400 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Preview */}
          <div style={{ flex:1,padding:20,background:"#f0f0f0",display:"flex",flexDirection:"column",gap:12,overflow:"auto" }}>
            <p style={{ fontWeight:600,fontSize:13,color:"#555",margin:0 }}>Preview</p>
            <div style={{ background:"#fff",borderRadius:8,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,.1)",display:"flex",alignItems:"center",justifyContent:"center",flex:1,minHeight:200 }}>
              <img ref={imgRef} src={src} alt="preview"
                style={{ maxWidth:"100%",maxHeight:320,filter:filterCSS,border,borderRadius:borderRadius+"px",boxShadow,objectFit:"contain",
                  clipPath:`inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)` }}/>
            </div>
            <button onClick={handleSave}
              style={{ background:WORD_BLUE,color:"#fff",border:"none",borderRadius:8,padding:"10px 0",fontSize:14,fontWeight:600,cursor:"pointer" }}>
              ✅ Apply & Insert Image
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TEXT BOX DIALOG — With Border / Without Border + style options
// ═══════════════════════════════════════════════════════════
function TextBoxDialog({onInsert,onClose}){
  const [hasBorder,setHasBorder]=useState(true)
  const [borderStyle,setBorderStyle]=useState("solid")
  const [borderColor,setBorderColor]=useState("#2b579a")
  const [borderWidth,setBorderWidth]=useState(2)
  const [bg,setBg]=useState("#ffffff")
  const [shadow,setShadow]=useState(true)
  const [radius,setRadius]=useState(4)
  const [width,setWidth]=useState(220)
  const [height,setHeight]=useState(90)

  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",
        alignItems:"center",justifyContent:"center",zIndex:9999}}>
      <div style={{background:"#fff",borderRadius:10,width:360,boxShadow:"0 12px 40px rgba(0,0,0,.28)",overflow:"hidden"}}>

        <div style={{background:WORD_BLUE,color:"#fff",padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700,fontSize:13}}>📦 Text Box</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        <div style={{padding:14,display:"flex",flexDirection:"column",gap:10}}>

          {/* Border toggle cards */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div onClick={()=>setHasBorder(true)}
              style={{padding:8,borderRadius:6,border:`2px solid ${hasBorder?WORD_BLUE:"#ddd"}`,
                background:hasBorder?"#eaf1fb":"#fafafa",cursor:"pointer",textAlign:"center"}}>
              <div style={{height:30,border:`2px solid ${borderColor}`,borderRadius:3,
                background:bg,boxShadow:"1px 1px 4px rgba(0,0,0,.1)",marginBottom:4,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#888"}}></div>
              <span style={{fontSize:11,fontWeight:hasBorder?700:400,color:hasBorder?WORD_BLUE:"#555"}}>✅ With Border</span>
            </div>
            <div onClick={()=>setHasBorder(false)}
              style={{padding:8,borderRadius:6,border:`2px solid ${!hasBorder?WORD_BLUE:"#ddd"}`,
                background:!hasBorder?"#eaf1fb":"#fafafa",cursor:"pointer",textAlign:"center"}}>
              <div style={{height:30,border:"none",borderRadius:3,marginBottom:4,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#aaa",
                backgroundImage:"repeating-linear-gradient(45deg,#eee 0,#eee 1px,transparent 0,transparent 50%)",
                backgroundSize:"6px 6px"}}></div>
              <span style={{fontSize:11,fontWeight:!hasBorder?700:400,color:!hasBorder?WORD_BLUE:"#555"}}>🚫 No Border</span>
            </div>
          </div>

          {/* Border options row */}
          {hasBorder&&(
            <div style={{display:"flex",gap:6,alignItems:"center",background:"#f7f9fc",borderRadius:6,padding:8,flexWrap:"wrap"}}>
              <select value={borderStyle} onChange={e=>setBorderStyle(e.target.value)}
                style={{flex:1,minWidth:70,padding:"3px 5px",border:`1px solid ${BORDER}`,borderRadius:3,fontSize:11}}>
                {["solid","dashed","dotted","double","groove","ridge"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <input type="color" value={borderColor} title="Color" onChange={e=>setBorderColor(e.target.value)}
                style={{width:26,height:22,padding:1,border:`1px solid ${BORDER}`,borderRadius:3,cursor:"pointer"}}/>
              <input type="number" min={1} max={8} value={borderWidth} title="Width" onChange={e=>setBorderWidth(parseInt(e.target.value)||1)}
                style={{width:34,padding:"3px 4px",border:`1px solid ${BORDER}`,borderRadius:3,fontSize:11}}/>
              <label style={{fontSize:11,display:"flex",alignItems:"center",gap:3,cursor:"pointer"}}>
                <input type="checkbox" checked={shadow} onChange={e=>setShadow(e.target.checked)}/> Shadow
              </label>
            </div>
          )}

          {/* Size + bg row */}
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <label style={{fontSize:11,color:"#555",display:"flex",alignItems:"center",gap:3}}>
              BG<input type="color" value={bg} onChange={e=>setBg(e.target.value)}
                style={{width:24,height:20,padding:1,border:`1px solid ${BORDER}`,borderRadius:3,cursor:"pointer"}}/>
            </label>
            <label style={{fontSize:11,color:"#555",display:"flex",alignItems:"center",gap:3}}>
              R<input type="number" min={0} max={40} value={radius} onChange={e=>setRadius(parseInt(e.target.value)||0)}
                style={{width:34,padding:"3px 4px",border:`1px solid ${BORDER}`,borderRadius:3,fontSize:11}}/>
            </label>
            <label style={{fontSize:11,color:"#555",display:"flex",alignItems:"center",gap:3}}>
              W<input type="number" min={80} max={700} value={width} onChange={e=>setWidth(parseInt(e.target.value)||220)}
                style={{width:44,padding:"3px 4px",border:`1px solid ${BORDER}`,borderRadius:3,fontSize:11}}/>
            </label>
            <label style={{fontSize:11,color:"#555",display:"flex",alignItems:"center",gap:3}}>
              H<input type="number" min={40} max={500} value={height} onChange={e=>setHeight(parseInt(e.target.value)||90)}
                style={{width:44,padding:"3px 4px",border:`1px solid ${BORDER}`,borderRadius:3,fontSize:11}}/>
            </label>
          </div>

          {/* Mini preview */}
          <div style={{background:"#f0f0f0",borderRadius:6,padding:10,display:"flex",alignItems:"center",justifyContent:"center",height:52}}>
            <div style={{border:hasBorder?`${borderWidth}px ${borderStyle} ${borderColor}`:"none",
              borderRadius:radius,padding:"4px 12px",background:bg,
              boxShadow:shadow&&hasBorder?"2px 2px 6px rgba(0,0,0,.15)":"none",
              fontSize:11,color:"#888",direction:"rtl"}}></div>
          </div>
        </div>

        <div style={{padding:"8px 14px",borderTop:`1px solid ${BORDER}`,display:"flex",justifyContent:"flex-end",gap:8}}>
          <button onClick={onClose}
            style={{padding:"5px 16px",border:`1px solid ${BORDER}`,borderRadius:5,background:"#fff",cursor:"pointer",fontSize:12}}>
            Cancel
          </button>
          <button onClick={()=>{onInsert({border:hasBorder,borderColor,borderStyle,borderWidth,bg,shadow,radius,width,height});onClose()}}
            style={{padding:"5px 16px",border:"none",borderRadius:5,background:WORD_BLUE,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>
            ✓ Insert
          </button>
        </div>
      </div>
    </div>
  )
}


export default function KashurEditor({docId:initialDocId=null,onBackToDashboard=null,dark:darkProp=false,toggleDark}){
  const {token,user}=useAuth()
  useEffect(()=>{
    window.__kashurEditorActive=true
    return()=>{window.__kashurEditorActive=false}
  },[])
  const [dark,setLocalDark]=useState(()=>{
    if(typeof window==="undefined")return Boolean(darkProp)
    return Boolean(darkProp)||window.localStorage.getItem("kashur-editor-dark")==="true"
  })
  const previousDarkPropRef=useRef(Boolean(darkProp))
  useEffect(()=>{
    const next=Boolean(darkProp)
    if(next!==previousDarkPropRef.current){
      previousDarkPropRef.current=next
      setLocalDark(next)
    }
  },[darkProp])
  useEffect(()=>{
    if(typeof window!=="undefined")window.localStorage.setItem("kashur-editor-dark",String(dark))
  },[dark])
  function toggleEditorDark(){
    setLocalDark(value=>!value)
    toggleDark?.()
  }
  function authFetch(path,opts={}){
    return fetch(`${API_BASE}${path}`,{...opts,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}),...opts.headers}})
  }

  const [docId,setDocId]=useState(initialDocId)
  const [docTitle,setDocTitle]=useState("Document 1")
  const [docCounter,setDocCounter]=useState(1)
  const [activeTab,setActiveTab]=useState("Home")
  // Table state must be initialized before the table effects below evaluate
  // their dependency arrays during the first render.
  const [activeTable,setActiveTable]=useState(null)
  const activeTableCellRef=useRef(null)
  const [fileOpen,setFileOpen]=useState(false)
  const [orientation,setOrientation]=useState("portrait")
  const [lineSpacing,setLineSpacing]=useState("1.8")
  const [fontSize,setFontSize]=useState(14)
  const [fontFamily,setFontFamily]=useState("'Noto Nastaliq Urdu', serif")
  const [zoom,setZoom]=useState(1)
  const [wordCount,setWordCount]=useState(0)
  const [charCount,setCharCount]=useState(0)
  const [charCountNoSpaces,setCharCountNoSpaces]=useState(0)
  const [paragraphCount,setParagraphCount]=useState(0)
  const [pageCount,setPageCount]=useState(1)
  const [pageMargins,setPageMargins]=useState({top:96,bottom:96,left:96,right:96,id:"normal"})
  const [saving,setSaving]=useState(false)
  const [savedMsg,setSavedMsg]=useState("")
  // ── ADMIN PANEL ADDITION — admin-managed fonts/templates/shapes ──────────
  // Kashur_FONTS and COVER_TEMPLATES are mutated in place (see useEffect
  // below); these two counters exist purely to force this component (and
  // its children, like the font dropdown and Cover Page dialog) to re-render
  // once the fetch resolves, since mutating a module-level array doesn't
  // trigger React updates on its own.
  const [, setFontsLoadedTick] = useState(0)
  const [, setTemplatesLoadedTick] = useState(0)
  const [customShapes, setCustomShapes] = useState([])
  // ADMIN PANEL ADDITION — admin-configured defaults (font, size, autosave)
  const [editorSettings, setEditorSettings] = useState(null)

  useEffect(()=>{
    // Shared Word-like list layout for every editable A4 page. Native
    // UL/OL markers keep numbering automatic and remain correct in exports.
    const id="kashur-word-list-styles"
    if(document.getElementById(id))return
    const style=document.createElement("style")
    style.id=id
    style.textContent=`
      @counter-style kashur-urdu-digits {
        system: numeric;
        symbols: "۰" "۱" "۲" "۳" "۴" "۵" "۶" "۷" "۸" "۹";
        suffix: ". ";
      }
      @counter-style decimal-paren { system: numeric; symbols: "0" "1" "2" "3" "4" "5" "6" "7" "8" "9"; suffix: ") "; }
      @counter-style decimal-brackets { system: numeric; symbols: "0" "1" "2" "3" "4" "5" "6" "7" "8" "9"; prefix: "("; suffix: ") "; }
      @counter-style lower-alpha-paren { system: alphabetic; symbols: a b c d e f g h i j k l m n o p q r s t u v w x y z; suffix: ") "; }
      [contenteditable="true"] ul,
      [contenteditable="true"] ol {
        list-style-position: outside;
        margin-block: 0;
        padding-inline-start: 0;
        padding-inline-end: 32px;
      }
      [contenteditable="true"] li {
        padding-inline-start: 4px;
        margin: 0;
        min-height: 1em;
        line-height: inherit;
        vertical-align: baseline;
      }
      [contenteditable="true"] li::marker {
        font-family: "Segoe UI Symbol", Arial, sans-serif;
        font-size: .82em;
        vertical-align: baseline;
      }
      [contenteditable="true"][data-document-theme] li::marker {
        color: var(--theme-accent1);
      }
      [contenteditable="true"][data-show-paragraph-marks="true"] > p::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] > div:not([data-shape])::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] > h1::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] > h2::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] > h3::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] > h4::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] > h5::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] > h6::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] > blockquote::after,
      [contenteditable="true"][data-show-paragraph-marks="true"] li::after {
        content: "¶";
        color: #2b579a;
        opacity: .72;
        font-family: "Segoe UI Symbol", Arial, sans-serif;
        font-size: .8em;
        font-weight: 600;
        direction: ltr;
        unicode-bidi: isolate;
        user-select: none;
        pointer-events: none;
      }
      [contenteditable="true"] li > ul,
      [contenteditable="true"] li > ol {
        margin-block: 0;
        margin-inline-start: 36px;
        width: calc(100% - 36px);
        box-sizing: border-box;
        padding-inline-end: 32px;
      }
      [contenteditable="true"] ul ul:not([data-custom-marker]) { list-style-type: circle; }
      [contenteditable="true"] ul ul ul:not([data-custom-marker]) { list-style-type: square; }
      [contenteditable="true"] ol ol:not([data-urdu-list]) { list-style-type: lower-alpha; }
      [contenteditable="true"] ol ol ol:not([data-urdu-list]) { list-style-type: lower-roman; }
      [contenteditable="true"] [data-multilevel] { counter-reset: word-level; }
      [contenteditable="true"] [data-multilevel] ol { counter-reset: word-level; }
      [contenteditable="true"] [data-multilevel]:not([data-multilevel="mixed"]) li {
        display: block;
        counter-increment: word-level;
        position: relative;
      }
      [contenteditable="true"] [data-multilevel]:not([data-multilevel="mixed"]) li::before {
        display: inline-block;
        min-width: 46px;
        margin-inline-end: 6px;
        text-align: end;
      }
      [contenteditable="true"] [data-multilevel="outline"] li::before,
      [contenteditable="true"] [data-multilevel="headings"] li::before {
        content: counters(word-level, ".") ".";
      }
      [contenteditable="true"] [data-multilevel="headings"] > li { font-weight:700; font-size:1.25em; }
      [contenteditable="true"] [data-multilevel="headings"] > li > ol > li { font-weight:600; font-size:.92em; }
      [contenteditable="true"] [data-multilevel="headings"] > li > ol > li > ol > li { font-weight:400; font-size:.9em; }
      [contenteditable="true"] [data-multilevel="paren"] > li::before { content: counter(word-level, decimal) ")"; }
      [contenteditable="true"] [data-multilevel="paren"] ol > li::before { content: counter(word-level, lower-alpha) ")"; }
      [contenteditable="true"] [data-multilevel="paren"] ol ol > li::before { content: counter(word-level, lower-roman) ")"; }
      [contenteditable="true"] [data-multilevel="article"] > li::before { content: "Article " counter(word-level, upper-roman); min-width:74px; }
      [contenteditable="true"] [data-multilevel="article"] ol > li::before { content: "Section 1." counter(word-level, decimal-leading-zero); min-width:86px; }
      [contenteditable="true"] [data-multilevel="article"] ol ol > li::before { content: "(" counter(word-level, lower-alpha) ")"; }
      [contenteditable="true"] [data-multilevel="chapter"] > li::before { content: "Chapter " counter(word-level); min-width:76px; }
      [contenteditable="true"] [data-multilevel="chapter"] ol > li::before { content: "Section " counters(word-level, "."); min-width:82px; }
      [contenteditable="true"] [data-multilevel="chapter"] ol ol > li::before { content: counters(word-level, ".") "."; }
      [contenteditable="true"] [data-multilevel="legal"] > li::before { content: counter(word-level, decimal) "."; }
      [contenteditable="true"] [data-multilevel="legal"] ol > li::before { content: counter(word-level, upper-alpha) "."; }
      [contenteditable="true"] [data-multilevel="legal"] ol ol > li::before { content: counter(word-level, decimal) "."; }
      [contenteditable="true"] [data-multilevel="mixed"] { list-style-type: "◆  "; }
      [contenteditable="true"] [data-multilevel="mixed"] ul { list-style-type: "➤  "; }
      [contenteditable="true"] [data-multilevel="mixed"] ul ul { list-style-type: square; }
    `
    document.head.appendChild(style)
    return()=>style.remove()
  },[])

  useEffect(() => {
    fetch(`${API_BASE}/public/fonts`).then(r => r.json()).then(d => {
      let added = false
      ;(d.fonts || []).forEach(f => {
        if (!Kashur_FONTS.some(k => primaryFontName(k.value) === primaryFontName(f.family))) {
          Kashur_FONTS.push({ label: f.name, value: f.family })
          Kashur_FONTS=uniqueFontList(Kashur_FONTS)
          added = true
        }
        // Actually load the font file, otherwise the family name just
        // shows up in the dropdown and silently falls back — nothing on
        // the page ever pointed the browser at the font's source before.
        if (f.url && !document.getElementById("kashur-admin-font-" + f._id)) {
          if (f.fileFormat === "google") {
            const link = document.createElement("link")
            link.id = "kashur-admin-font-" + f._id
            link.rel = "stylesheet"
            link.href = f.url
            document.head.appendChild(link)
          } else {
            const familyName = (f.family.match(/'([^']+)'/) || [null, f.family])[1]
            const style = document.createElement("style")
            style.id = "kashur-admin-font-" + f._id
            style.textContent = `@font-face{font-family:'${familyName}';src:url('${f.url}');font-display:swap;}`
            document.head.appendChild(style)
          }
        }
      })
      if (added) setFontsLoadedTick(t => t + 1)
    }).catch(() => {})

    fetch(`${API_BASE}/public/templates?category=cover-page`).then(r => r.json()).then(d => {
      let added = false
      ;(d.templates || []).forEach(t => {
        const id = "admin_" + t._id
        if (!COVER_TEMPLATES.some(c => c.id === id)) {
          COVER_TEMPLATES.push({ id, label: t.title, preview: "#6366f1", build: () => t.html })
          added = true
        }
      })
      if (added) setTemplatesLoadedTick(t => t + 1)
    }).catch(() => {})

    fetch(`${API_BASE}/public/shapes`).then(r => r.json()).then(d => {
      setCustomShapes(d.shapes || [])
    }).catch(() => {})

    // ADMIN PANEL ADDITION — fetch admin-configured editor defaults
    fetch(`${API_BASE}/settings/public`).then(r => r.json()).then(s => {
      setEditorSettings(s)
      // Only apply font/size defaults to a brand-new document — never
      // override an existing document's saved formatting.
      if (!initialDocId) {
        if (s.defaultFont) setFontFamily(s.defaultFont)
        if (s.defaultFontSize) setFontSize(s.defaultFontSize)
      }
    }).catch(() => {})
  }, [])
  // Spell check
  // Custom undo/redo history (fixes cross-page undo)
  const historyStack = useRef([])   // [{pages:[html,...],cursorOffset:number}, ...]
  const historyIdx   = useRef(-1)
  const historyLock  = useRef(false)
  const historySaveTimer = useRef(null)  // debounces history snapshots while typing
  const documentClipboardRef = useRef({html:"",text:""})
  const [,setHistoryVersion]=useState(0)
  const [showTable,setShowTable]=useState(false)
  const [showImage,setShowImage]=useState(false)
  const [showLink,setShowLink]=useState(false)
  const [linkSelectedText,setLinkSelectedText]=useState("")
  const [linkContext,setLinkContext]=useState(null)
  const [showOpen,setShowOpen]=useState(false)
  const [shareInfo,setShareInfo]=useState(null)
  const [shareLoading,setShareLoading]=useState(false)
  const [toast,setToast]=useState(null)
  const [modal,setModal]=useState(null)
  // ✅ NEW STATE
  // Feature 1: Live Chart
  const [showChartEditor,setShowChartEditor]=useState(false)
  const [chartEditorTarget,setChartEditorTarget]=useState(null)
  // Feature 2: TOC
  const [showTOC,setShowTOC]=useState(false)
  // Feature 3: Comments
  const [comments,setComments]=useState([])
  const [showComments,setShowComments]=useState(false)
  const [activeCommentId,setActiveCommentId]=useState(null)
  const [trackChanges,setTrackChanges]=useState(false)
  const [changes,setChanges]=useState([])
  // Feature 4: Image Editor
  const [showImageEditor,setShowImageEditor]=useState(false)
  const [imageEditorSrc,setImageEditorSrc]=useState("")
  const [imageEditorCallback,setImageEditorCallback]=useState(null)
  // Layout
  const [indentLeft,setIndentLeft]=useState(0)
  const [indentRight,setIndentRight]=useState(0)
  const [spaceBefore,setSpaceBefore]=useState(0)
  const [spaceAfter,setSpaceAfter]=useState(8)
  const [theme,setTheme]=useState("Office")
  const [pageColor,setPageColor]=useState("#ffffff")
  const [pageBorderStyle,setPageBorderStyle]=useState("none")
  const [pageBorderWidth,setPageBorderWidth]=useState(2)
  const [pageBorderColor,setPageBorderColor]=useState("#2b579a")
  const [pageBorderSetting,setPageBorderSetting]=useState("none")
  const [pageBorderSides,setPageBorderSides]=useState({top:true,right:true,bottom:true,left:true})
  const [watermark,setWatermark]=useState({
    type:"none",text:"",font:"'Segoe UI', Arial, sans-serif",
    size:56,color:"#b8b8b8",opacity:.28,layout:"diagonal",
  })
  const [selectedShape,setSelectedShape]=useState(null)
  const [,refreshSelectedShape]=useState(0)
  const [showHeader,setShowHeader]=useState(false)
  const [showFooter,setShowFooter]=useState(false)
  const [headerText,setHeaderText]=useState("")
  const [footerText,setFooterText]=useState("")
  const [pageNumber,setPageNumber]=useState(false)
  const [headerStyle,setHeaderStyle]=useState("blank")
  const [headerAlign,setHeaderAlign]=useState("center")
  const [footerStyle,setFooterStyle]=useState("blank")
  const [footerAlign,setFooterAlign]=useState("left")
  const [pageNumberPosition,setPageNumberPosition]=useState("bottom-right")
  const [pageNumberFormat,setPageNumberFormat]=useState("number")
  const [pageNumberStart,setPageNumberStart]=useState(1)
  // keyboard
  const [kbOpen,setKbOpen]=useState(false)
  const [kbView,setKbView]=useState("phonetic")
  const [kbShift,setKbShift]=useState(false)
  const [kbCaps,setKbCaps]=useState(false)
  const [kbW,setKbW]=useState(520)
  const [kbH,setKbH]=useState(260)
  const [kbPos,setKbPos]=useState({x:60,y:null})
  const [phoneticMode,setPhoneticMode]=useState(false)
  const [readMode,setReadMode]=useState(false)
  const [readPageIndex,setReadPageIndex]=useState(0)
  const [readZoom,setReadZoom]=useState(1)
  const [documentView,setDocumentView]=useState("print")
  const [showNavigationPane,setShowNavigationPane]=useState(false)
  const [activeViewPage,setActiveViewPage]=useState(0)
  const [navigationTab,setNavigationTab]=useState("headings")
  const [navigationQuery,setNavigationQuery]=useState("")
  const [showParagraphMarks,setShowParagraphMarks]=useState(false)
  const phoneticBuffer=useRef("")
  const phoneticModeRef=useRef(false)
  const pagesRef=useRef([])
  const pageAreaRef=useRef(null)
  const readAreaRef=useRef(null)
  const activePgRef=useRef(null)
  const fMenuRef=useRef(null)
  const spillTimer=useRef(null)
  const spillFrameRef=useRef(null)
  const autoSaveTimer=useRef(null)
  const saveNowRef=useRef(null)
  const saveInFlightRef=useRef(false)
  const savedMsgTimerRef=useRef(null)
  const dirtyRef=useRef(false)
  const docIdRef=useRef(initialDocId)
  const docTitleRef=useRef("Document 1")
  const savedRangeRef=useRef(null)
  const toolbarInteractionRef=useRef(false)
  const pendingSpillCursorRef=useRef(null)

  useEffect(()=>{docIdRef.current=docId},[docId])
  useEffect(()=>{docTitleRef.current=docTitle},[docTitle])
  useEffect(()=>{phoneticModeRef.current=phoneticMode},[phoneticMode])
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>renumberNumberedHeadings())
    return()=>cancelAnimationFrame(frame)
  },[pageCount,docId])

  useEffect(()=>{
    const id="kashur-gfonts"
    const href="https://fonts.googleapis.com/css2?family=Amiri&family=Aref+Ruqaa&family=Baloo+Bhaijaan+2&family=Cairo&family=El+Messiri&family=Gulzar&family=IBM+Plex+Sans+Arabic&family=Kufam&family=Lateef&family=Noto+Kufi+Arabic&family=Noto+Naskh+Arabic&family=Noto+Nastaliq+Urdu&family=Readex+Pro&family=Reem+Kufi&family=Rubik&family=Scheherazade+New&family=Tajawal&family=Vazirmatn&display=swap"
    let link=document.getElementById(id)
    if(!link){
      link=document.createElement("link")
      link.id=id
      link.rel="stylesheet"
      document.head.appendChild(link)
    }
    // During Vite hot reload the old link remains in <head>. Always update
    // its URL so newly-added families do not silently fall back to Noto.
    if(link.getAttribute("href")!==href)link.setAttribute("href",href)
    const refresh=()=>setFontsLoadedTick(t=>t+1)
    link.addEventListener("load",refresh)
    document.fonts?.ready.then(refresh).catch(()=>{})
    return()=>link.removeEventListener("load",refresh)
  },[])

  function showToast(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),3000)}
  function showSaveStatus(message,duration=2500){
    clearTimeout(savedMsgTimerRef.current)
    setSavedMsg(message)
    if(duration>0)savedMsgTimerRef.current=setTimeout(()=>setSavedMsg(""),duration)
  }
  function showModal(cfg){setModal(cfg)}
  function closeModal(){setModal(null)}
  function regPage(i,el){
    pagesRef.current[i]=el
    if(i===0&&el&&!activePgRef.current)activePgRef.current=el
    if(el){
      // Remove artifacts created by the retired custom click-position system.
      // Normal paragraphs and their text/formatting remain unchanged.
      el.querySelectorAll("[data-click-flow],[data-click-type]").forEach(block=>{
        block.removeAttribute("data-click-flow")
        block.removeAttribute("data-click-type")
        block.style.position=""
        block.style.top=""
        block.style.left=""
        block.style.width=""
        block.style.marginTop="0"
        block.style.paddingLeft="0"
        block.style.paddingRight="0"
      })
      window._irs?.(el)
    }
  }
  function saveSelection(){
    const sel=window.getSelection();if(!sel||sel.rangeCount===0)return
    const range=sel.getRangeAt(0)
    const startPage=pagesRef.current.find(p=>p&&(p===range.startContainer||p.contains(range.startContainer)))
    const endPage=pagesRef.current.find(p=>p&&(p===range.endContainer||p.contains(range.endContainer)))
    if(startPage&&endPage){
      savedRangeRef.current=range.cloneRange()
      activePgRef.current=startPage
    }
  }

  // ── Live selection tracking (fixes: toolbar actions / inserts landing on a
  //    stale cursor position instead of wherever the user is actually typing,
  //    especially across multiple pages). Whenever the real browser selection
  //    sits inside one of our editable pages, keep savedRangeRef AND
  //    activePgRef continuously in sync with it. This way, restoreSelection()
  //    only ever falls back to an "old" range for the brief moment focus is
  //    away from the editor (e.g. while a dialog/select is open) — it never
  //    overwrites a selection the user has since moved with the mouse/keys.
  useEffect(()=>{
    function onSelectionChange(){
      const sel=window.getSelection()
      if(!sel||sel.rangeCount===0)return
      const range=sel.getRangeAt(0)
      const startPage=pagesRef.current.find(p=>p&&(p===range.startContainer||p.contains(range.startContainer)))
      const endPage=pagesRef.current.find(p=>p&&(p===range.endContainer||p.contains(range.endContainer)))
      if(startPage&&endPage){
        // A toolbar mousedown can collapse a selected range before its click
        // handler runs. Do not let that temporary caret overwrite the text
        // range the user deliberately selected in the editor.
        const previous=savedRangeRef.current
        if(range.collapsed&&previous&&!previous.collapsed&&toolbarInteractionRef.current)return
        savedRangeRef.current=range.cloneRange()
        activePgRef.current=startPage
      }
    }
    function onPointerDown(e){
      // Snapshot before the browser processes a toolbar click. Its default
      // behavior may collapse the selected text before React runs onClick.
      onSelectionChange()
      const clickedPage=pagesRef.current.some(p=>p&&p.contains(e.target))
      if(!clickedPage){
        toolbarInteractionRef.current=true
        setTimeout(()=>{toolbarInteractionRef.current=false},0)
      }
    }
    document.addEventListener("selectionchange",onSelectionChange)
    document.addEventListener("mousedown",onPointerDown,true)
    return()=>{
      document.removeEventListener("selectionchange",onSelectionChange)
      document.removeEventListener("mousedown",onPointerDown,true)
    }
  },[])

  // Make sure the page that actually holds the live cursor has real DOM
  // focus before we run an execCommand/insert — needed after focus has
  // been on a toolbar control, <select>, or modal input.
  function ensureFocus(){
    const range=savedRangeRef.current
    const pg=(range && pagesRef.current.find(p=>p&&(p===range.startContainer||p.contains(range.startContainer))))
      || activePgRef.current || pagesRef.current[0]
    if(pg && document.activeElement!==pg) pg.focus({preventScroll:true})
    return pg
  }

  function restoreSelection(){
    // Copy the saved range *before* focus changes. Focusing a contentEditable
    // can synchronously create a collapsed selection and fire selectionchange.
    const saved=savedRangeRef.current?.cloneRange()
    const savedStartPage=saved&&pagesRef.current.find(p=>p&&(p===saved.startContainer||p.contains(saved.startContainer)))
    const savedEndPage=saved&&pagesRef.current.find(p=>p&&(p===saved.endContainer||p.contains(saved.endContainer)))
    if(savedStartPage&&savedEndPage){
      if(document.activeElement!==savedStartPage)savedStartPage.focus({preventScroll:true})
      const selection=window.getSelection();if(!selection)return false
      selection.removeAllRanges();selection.addRange(saved)
      savedRangeRef.current=saved.cloneRange();activePgRef.current=savedStartPage
      return true
    }
    const pg=ensureFocus();if(!pg)return false
    const sel=window.getSelection();if(!sel)return false
    // Prefer the range captured before a toolbar click. Calling focus() can
    // create a new collapsed caret in the page, which must not replace the
    // user's selected text before a font-size command is applied.
    if(savedRangeRef.current && pg.contains(savedRangeRef.current.commonAncestorContainer)){
      sel.removeAllRanges();sel.addRange(savedRangeRef.current);return true
    }
    // If the live selection is already inside the correct page, leave it
    // exactly where the user put it — don't clobber it with an older range.
    if(sel.rangeCount>0 && pg.contains(sel.getRangeAt(0).commonAncestorContainer)) return true
    if(savedRangeRef.current && pg.contains(savedRangeRef.current.commonAncestorContainer)){
      sel.removeAllRanges();sel.addRange(savedRangeRef.current);return true
    }
    return false
  }
  function focusPageCaret(page,atEnd=false){
    if(!page)return
    page.focus({preventScroll:true})
    const range=document.createRange();range.selectNodeContents(page);range.collapse(atEnd)
    const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
    savedRangeRef.current=range.cloneRange();activePgRef.current=page
  }

  // When Enter creates a genuinely empty line at the end of formatted text,
  // browsers can carry the previous inline font span into that line. Remove
  // only font size/family from the empty line and recreate its caret so new
  // typing starts with the page default. Lines containing text are untouched.
  function resetEmptyCaretLine(page){
    const selection=window.getSelection()
    if(!page||!selection||selection.rangeCount===0)return
    const live=selection.getRangeAt(0)
    if(!live.collapsed||!page.contains(live.startContainer))return
    const caretElement=live.startContainer.nodeType===1
      ?live.startContainer
      :live.startContainer.parentElement
    const listItem=caretElement?.closest?.("li")
    if(listItem&&page.contains(listItem)){
      if((listItem.textContent||"").replace(/\u200B/g,"").trim())return
      // Enter inside a list must leave the caret inside the newly-created LI.
      // The previous code climbed to the parent UL/OL and replaced the whole
      // list with <br>, which made the caret appear above the next marker.
      listItem.style.fontSize=""
      listItem.style.fontFamily=""
      listItem.style.lineHeight="inherit"
      listItem.querySelectorAll("span").forEach(span=>{
        span.style.fontSize=""
        span.style.fontFamily=""
      })
      if(!listItem.childNodes.length)listItem.innerHTML="<br>"
      const range=document.createRange()
      range.selectNodeContents(listItem);range.collapse(true)
      page.focus({preventScroll:true})
      selection.removeAllRanges();selection.addRange(range)
      savedRangeRef.current=range.cloneRange();activePgRef.current=page
      return
    }
    let block=live.startContainer.nodeType===1
      ?live.startContainer
      :live.startContainer.parentElement
    while(block&&block!==page&&block.parentElement!==page)block=block.parentElement
    if(!block||block===page||(block.textContent||"").replace(/\u200B/g,"").trim())return

    block.style.fontSize=""
    block.style.fontFamily=""
    block.querySelectorAll("span").forEach(span=>{
      span.style.fontSize=""
      span.style.fontFamily=""
    })
    block.innerHTML="<br>"
    const range=document.createRange()
    range.selectNodeContents(block);range.collapse(true)
    page.focus();selection.removeAllRanges();selection.addRange(range)
    savedRangeRef.current=range.cloneRange();activePgRef.current=page
  }

  function applySpanStyle(prop,value){
    restoreSelection();const sel=window.getSelection();if(!sel||sel.rangeCount===0)return
    const range=sel.getRangeAt(0)
    if(range.collapsed){
      // No text selected — just a blinking cursor. Insert an invisible
      // "typing marker" span styled with the requested value and drop the
      // caret inside it, so whatever the user types next inherits the new
      // size/family right where the cursor is (this is how Word/Docs apply
      // font size at the caret with nothing selected). The previous
      // implementation called the legacy execCommand("fontSize","7") hack,
      // which ignored the chosen size entirely and always jumped to the
      // largest legacy size — that was the "grow/shrink font" bug.
      const span=document.createElement("span")
      span.style[prop]=value
      span.setAttribute("data-typing-marker","1")
      span.appendChild(document.createTextNode("\u200B"))
      range.insertNode(span)
      const newRange=document.createRange()
      newRange.setStart(span.firstChild,1)
      newRange.collapse(true)
      sel.removeAllRanges();sel.addRange(newRange)
      dirtyRef.current=true;updateStats()
      return
    }
    const frag=range.extractContents()

    // A selected passage may already contain spans created by an earlier
    // font-size/font-family change. Remove only the same property from those
    // descendants before applying the new value. Otherwise repeated Grow /
    // Shrink operations produce nested, conflicting sizes and the old larger
    // span keeps an oversized line box even after the text is made smaller.
    frag.querySelectorAll?.("span").forEach(child=>{
      child.style[prop]=""
      if(!child.getAttribute("style")?.trim())child.removeAttribute("style")
    })

    const span=document.createElement("span");span.style[prop]=value;span.appendChild(frag);range.insertNode(span)

    // If the complete contents of a previous formatting span were selected,
    // the new span now sits inside that old wrapper. Clear the duplicate
    // property from such empty wrappers so line height and baseline are
    // calculated from the newly selected size, like Word/Google Docs.
    let parent=span.parentElement
    while(parent&&parent.tagName==="SPAN"&&parent.textContent===span.textContent){
      parent.style[prop]=""
      if(!parent.getAttribute("style")?.trim())parent.removeAttribute("style")
      parent=parent.parentElement
    }

    const newRange=document.createRange();newRange.selectNodeContents(span);sel.removeAllRanges();sel.addRange(newRange)
    dirtyRef.current=true;updateStats()
  }

  // ── Custom history for cross-page undo/redo ─────────────────────────────
  function collectTrackedChangesFromDocument(){
    return pagesRef.current.filter(Boolean).flatMap(page=>
      Array.from(page.querySelectorAll("[data-tracked-change][data-change-id]")).map(node=>({
        id:node.dataset.changeId,
        type:node.dataset.trackedChange,
        text:node.textContent||"",
        time:Number(node.dataset.changeTime)||Date.now(),
      }))
    )
  }
  function saveHistory(overrides={}){
    if(historyLock.current) return
    const pages=pagesRef.current.filter(Boolean).map(p=>p.innerHTML)
    const snap={
      pages,
      cursorOffset:getCursorPos()?.offset??null,
      comments:(overrides.comments||comments).map(comment=>({...comment})),
      // Read tracked revisions from the live document. React state may still
      // be one render behind immediately after beforeinput.
      changes:(overrides.changes??collectTrackedChangesFromDocument())
        .map(change=>({...change})),
      trackChanges:typeof overrides.trackChanges==="boolean"
        ?overrides.trackChanges
        :trackChanges,
    }
    // Skip if nothing actually changed since the last snapshot — avoids
    // pointless duplicate history entries (and burning the redo stack) when
    // saveHistory fires from both the input-debounce and a toolbar command.
    const last=historyStack.current[historyIdx.current]
    const lastPages=Array.isArray(last)?last:last?.pages
    const pagesMatch=lastPages
      &&lastPages.length===pages.length
      &&lastPages.every((html,index)=>html===pages[index])
    const metadataMatch=Array.isArray(last)
      ||(last
        &&JSON.stringify(last.comments||[])===JSON.stringify(snap.comments)
        &&JSON.stringify(last.changes||[])===JSON.stringify(snap.changes)
        &&Boolean(last.trackChanges)===Boolean(snap.trackChanges))
    if(pagesMatch&&metadataMatch)return
    // Trim forward history if we're mid-stack
    historyStack.current=historyStack.current.slice(0,historyIdx.current+1)
    historyStack.current.push(snap)
    if(historyStack.current.length>80) historyStack.current.shift()
    historyIdx.current=historyStack.current.length-1
    setHistoryVersion(version=>version+1)
  }
  function resetHistory(){
    // Called whenever a fresh document (new or opened) replaces page
    // content, so undo/redo can't reach across two unrelated documents.
    historyStack.current=[]
    historyIdx.current=-1
    setHistoryVersion(version=>version+1)
    setTimeout(()=>saveHistory(),150) // baseline snapshot once pages are populated
  }
  function restoreHistory(idx){
    const entry=historyStack.current[idx]
    if(!entry)return
    const snap=Array.isArray(entry)?entry:entry.pages
    const cursorOffset=Array.isArray(entry)?null:entry.cursorOffset
    if(!snap?.length)return
    historyLock.current=true
    clearTimeout(historySaveTimer.current)
    historySaveTimer.current=null
    flushSync(()=>setPageCount(Math.max(1,snap.length)))
    snap.forEach((html,index)=>{
      if(pagesRef.current[index])pagesRef.current[index].innerHTML=html
    })
    initAllObjects()
    if(!Array.isArray(entry)&&entry.comments)setComments(entry.comments.map(comment=>({...comment})))
    setChanges(collectTrackedChangesFromDocument())
    const restoredTracking=!Array.isArray(entry)&&typeof entry.trackChanges==="boolean"
      ?entry.trackChanges:trackChanges
    if(!Array.isArray(entry)&&typeof entry.trackChanges==="boolean")
      setTrackChanges(restoredTracking)
    applyTrackedInsertAppearance(restoredTracking)
    historyIdx.current=idx
    dirtyRef.current=true
    updateStats()
    setHistoryVersion(version=>version+1)
    requestAnimationFrame(()=>{
      if(cursorOffset!==null)restoreCursorPos({offset:cursorOffset})
      else focusPageCaret(pagesRef.current.filter(Boolean).slice(-1)[0],true)
      historyLock.current=false
    })
  }
  function customUndo(){
    // Flush a pending debounced snapshot first, so undo doesn't skip past
    // whatever was just typed in the last 600ms.
    if(historySaveTimer.current){
      clearTimeout(historySaveTimer.current)
      historySaveTimer.current=null
      saveHistory()
    }
    if(historyIdx.current>0) restoreHistory(historyIdx.current-1)
  }
  function customRedo(){
    if(historyIdx.current<historyStack.current.length-1) restoreHistory(historyIdx.current+1)
  }

  function selectedDocumentRange(){
    restoreSelection()
    const selection=window.getSelection()
    if(!selection?.rangeCount)return null
    const range=selection.getRangeAt(0)
    if(range.collapsed)return null
    const touchesPage=pagesRef.current.some(page=>{
      if(!page)return false
      try{return range.intersectsNode(page)}catch{return false}
    })
    return touchesPage?range:null
  }

  function pageRangesForSelection(range){
    return pagesRef.current.filter(Boolean).flatMap(page=>{
      let intersects=false
      try{intersects=range.intersectsNode(page)}catch{}
      if(!intersects)return[]
      const sub=document.createRange()
      if(page.contains(range.startContainer))
        sub.setStart(range.startContainer,range.startOffset)
      else sub.setStart(page,0)
      if(page.contains(range.endContainer))
        sub.setEnd(range.endContainer,range.endOffset)
      else sub.setEnd(page,page.childNodes.length)
      return sub.collapsed?[]:[{page,range:sub}]
    })
  }

  function clipboardPayloadFromRange(range){
    const pieces=pageRangesForSelection(range)
    if(!pieces.length)return null
    const html=[],text=[]
    pieces.forEach(({range:pageRange})=>{
      const holder=document.createElement("div")
      holder.appendChild(pageRange.cloneContents())
      html.push(`<div data-word-clipboard-page="true">${holder.innerHTML}</div>`)
      text.push((holder.innerText||holder.textContent||"").replace(/\u200B/g,""))
    })
    return {html:html.join(""),text:text.join("\n")}
  }

  async function writeDocumentClipboard(payload){
    documentClipboardRef.current=payload
    try{
      if(navigator.clipboard?.write&&window.ClipboardItem){
        await navigator.clipboard.write([new window.ClipboardItem({
          "text/html":new Blob([payload.html],{type:"text/html"}),
          "text/plain":new Blob([payload.text],{type:"text/plain"}),
        })])
      }else if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(payload.text)
      }
    }catch{
      // The in-editor clipboard remains available when browser clipboard
      // permission is denied or the app is running on an insecure origin.
    }
  }

  function copyDocumentSelection(){
    const range=selectedDocumentRange()
    const payload=range&&clipboardPayloadFromRange(range)
    if(!payload){showToast("Select document text or objects to copy","error");return false}
    savedRangeRef.current=range.cloneRange()
    writeDocumentClipboard(payload)
    showToast("Copied to clipboard")
    return true
  }

  function cutDocumentSelection(){
    const range=selectedDocumentRange()
    const payload=range&&clipboardPayloadFromRange(range)
    if(!range||!payload){showToast("Select document text or objects to cut","error");return false}
    writeDocumentClipboard(payload)
    saveHistory()

    const startPieces=pageRangesForSelection(range)
    const firstPiece=startPieces[0]
    let cursorOffset=0
    if(firstPiece){
      for(const page of pagesRef.current.filter(Boolean)){
        if(page===firstPiece.page)break
        const pageRange=document.createRange()
        pageRange.selectNodeContents(page)
        cursorOffset+=pageRange.toString().length
      }
      const before=document.createRange()
      before.selectNodeContents(firstPiece.page)
      before.setEnd(firstPiece.range.startContainer,firstPiece.range.startOffset)
      cursorOffset+=before.toString().length
    }

    const singlePage=firstPiece&&startPieces.length===1
    if(trackChanges&&singlePage){
      deleteTrackedRange(firstPiece.range,firstPiece.page,"selection")
      scheduleTrackedHistory()
    }else{
      startPieces.slice().reverse().forEach(({range:pageRange})=>pageRange.deleteContents())
      pagesRef.current.filter(Boolean).forEach(page=>{
        const hasContent=(page.textContent||"").replace(/\u200B/g,"").trim()
          ||page.querySelector("img,table,[data-shape],[data-chart],hr")
        if(!hasContent)page.innerHTML="<p><br></p>"
      })
      restoreCursorPos({offset:cursorOffset})
    }
    dirtyRef.current=true
    updateStats()
    saveHistory()
    requestAnimationFrame(()=>spillCheck())
    showToast("Selection cut")
    return true
  }

  function sanitizeClipboardHTML(html){
    const template=document.createElement("template")
    template.innerHTML=String(html||"")
    template.content.querySelectorAll("script,style,link,meta,iframe,object,embed")
      .forEach(node=>node.remove())
    template.content.querySelectorAll("*").forEach(node=>{
      Array.from(node.attributes).forEach(attribute=>{
        const name=attribute.name.toLowerCase()
        const value=attribute.value.trim()
        if(name.startsWith("on")
          ||((name==="href"||name==="src")&&/^javascript:/i.test(value)))
          node.removeAttribute(attribute.name)
        if(name==="id")node.removeAttribute("id")
      })
    })
    return template.innerHTML
  }

  async function readDocumentClipboard(){
    let html="",text=""
    try{
      if(navigator.clipboard?.read){
        const items=await navigator.clipboard.read()
        for(const item of items){
          if(!html&&item.types.includes("text/html"))
            html=await (await item.getType("text/html")).text()
          if(!text&&item.types.includes("text/plain"))
            text=await (await item.getType("text/plain")).text()
        }
      }else if(navigator.clipboard?.readText){
        text=await navigator.clipboard.readText()
      }
    }catch{}
    const internal=documentClipboardRef.current
    if(!html&&internal.html&&(!text||text===internal.text))html=internal.html
    if(!text&&internal.text)text=internal.text
    return {html,text}
  }

  async function pasteDocumentClipboard(){
    const saved=savedRangeRef.current?.cloneRange()
    const payload=await readDocumentClipboard()
    if(saved?.startContainer?.isConnected)savedRangeRef.current=saved
    restoreSelection()
    const selection=window.getSelection()
    if(!selection?.rangeCount){showToast("Place the cursor in the document first","error");return false}
    const range=selection.getRangeAt(0)
    const page=pagesRef.current.find(current=>current
      &&current.contains(range.startContainer)
      &&current.contains(range.endContainer))
    if(!page){showToast("Place the cursor in the document first","error");return false}
    if(!payload.html&&!payload.text){showToast("Clipboard is empty","error");return false}

    saveHistory()
    if(trackChanges&&payload.text){
      insertTrackedText(range,payload.text,page)
      scheduleTrackedHistory()
    }else{
      const escapedText=String(payload.text||"")
        .replace(/[&<>]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[char]))
        .replace(/\r?\n/g,"<br>")
      const html=sanitizeClipboardHTML(payload.html)||escapedText
      range.deleteContents()
      const holder=document.createElement("div")
      holder.innerHTML=html
      const fragment=document.createDocumentFragment()
      let lastNode=null
      while(holder.firstChild){lastNode=fragment.appendChild(holder.firstChild)}
      range.insertNode(fragment)
      if(lastNode)setCaretAfterNode(lastNode,page)
      initAllObjects()
    }
    dirtyRef.current=true
    updateStats()
    saveHistory()
    requestAnimationFrame(()=>spillCheck())
    showToast("Pasted")
    return true
  }

  function exec(command,value=null){
    const pg=activePgRef.current||pagesRef.current[0];if(!pg)return
    if(command==="insertText"&&insertTrackedCommandText(value))return
    // Save history before destructive commands
    if(["bold","italic","underline","strikeThrough","insertHTML","insertText",
        "formatBlock","fontSize","fontName","foreColor","hiliteColor",
        "insertOrderedList","insertUnorderedList","delete","insertParagraph"].includes(command)){
      saveHistory()
    }
    restoreSelection()
    // CSS output preserves exact colours in saved HTML. Chromium supports
    // hiliteColor; backColor is the compatible fallback used by Firefox and
    // older WebViews.
    if(command==="foreColor"||command==="hiliteColor")xCmd("styleWithCSS",true)
    let applied=xCmd(command,value)
    if(command==="hiliteColor"&&!applied)applied=xCmd("backColor",value)
    const liveSelection=window.getSelection()
    if(liveSelection?.rangeCount){
      savedRangeRef.current=liveSelection.getRangeAt(0).cloneRange()
      const page=pagesRef.current.find(current=>current?.contains(liveSelection.anchorNode))
      if(page)activePgRef.current=page
    }
    updateStats();dirtyRef.current=true
    if(command==="foreColor"||command==="hiliteColor")saveHistory()
  }

  function selectAllDocument(){
    const pages=pagesRef.current.filter(Boolean)
    if(!pages.length)return
    const firstPage=pages[0],lastPage=pages[pages.length-1]
    firstPage.focus({preventScroll:true})
    const range=document.createRange()
    range.setStart(firstPage,0)
    range.setEnd(lastPage,lastPage.childNodes.length)
    const selection=window.getSelection()
    if(!selection)return
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current=range.cloneRange()
    activePgRef.current=firstPage
    showToast(pages.length===1?"Page content selected":"All document pages selected")
  }

  // ── Clear ALL formatting (like MS Word Clear Formatting) ─────────────────
  function clearAllFormatting(){
    restoreSelection()
    const sel=window.getSelection(); if(!sel||sel.rangeCount===0) return
    const range=sel.getRangeAt(0)
    if(range.collapsed){
      // No selection — clear entire paragraph's inline styles
      let el=sel.anchorNode; while(el&&el.nodeType===3) el=el.parentElement
      while(el&&!["P","DIV","H1","H2","H3","H4","LI","BLOCKQUOTE"].includes(el.tagName)) el=el.parentElement
      if(el){ el.removeAttribute("style"); el.querySelectorAll("[style]").forEach(c=>c.removeAttribute("style")) }
      return
    }
    saveHistory()
    // Extract, strip all spans/styles, reinsert plain text
    const frag=range.extractContents()
    const stripped=document.createDocumentFragment()
    function stripNode(n){
      if(n.nodeType===3){ stripped.appendChild(n.cloneNode()); return }
      if(["BR","HR"].includes(n.tagName)){ stripped.appendChild(n.cloneNode()); return }
      if(["B","I","U","STRONG","EM","SPAN","FONT","MARK"].includes(n.tagName)){
        Array.from(n.childNodes).forEach(c=>stripNode(c))
      } else {
        const clone=n.cloneNode(false); clone.removeAttribute("style"); clone.removeAttribute("class"); clone.removeAttribute("color"); clone.removeAttribute("face"); clone.removeAttribute("size")
        Array.from(n.childNodes).forEach(c=>{ const r=document.createDocumentFragment(); function strip2(x){ if(x.nodeType===3){r.appendChild(x.cloneNode());return}if(["B","I","U","STRONG","EM","SPAN","FONT","MARK"].includes(x.tagName)){Array.from(x.childNodes).forEach(strip2)}else{const cc=x.cloneNode(false);cc.removeAttribute("style");Array.from(x.childNodes).forEach(cc2=>strip2(cc2));r.appendChild(cc)}} strip2(c); clone.appendChild(r) })
        stripped.appendChild(clone)
      }
    }
    Array.from(frag.childNodes).forEach(n=>stripNode(n))
    range.insertNode(stripped)
    dirtyRef.current=true; updateStats()
  }

  // ── Text Box insert ───────────────────────────────────────────────────────
  const [showTextBoxDlg,setShowTextBoxDlg]=useState(false)
  function insertTextBox(opts={}){
    const id="tb_"+Date.now()
    const {
      border=true,
      borderColor="#2b579a",
      borderStyle="solid",
      borderWidth=2,
      bg="#fff",
      shadow=true,
      radius=4,
      width=220,
      height=90,
    }=opts
    const borderCSS=border
      ? `border:${borderWidth}px ${borderStyle} ${borderColor};`
      : "border:none;"
    const shadowCSS=shadow&&border ? "box-shadow:2px 2px 8px rgba(0,0,0,.12);" : ""
    exec("insertHTML",`<div id="${id}" contenteditable="false" data-shape="textbox"
      style="display:inline-block;position:relative;width:${width}px;min-height:${height}px;${borderCSS}border-radius:${radius}px;padding:12px 16px;background:${bg};${shadowCSS}vertical-align:middle;margin:8px;cursor:move;box-sizing:border-box;direction:rtl;text-align:right;">
      <div class="shape-text" data-text-position="inside" contenteditable="true"
        style="min-height:${Math.max(24,height-30)}px;outline:1px dashed rgba(43,87,154,.45);font-size:14px;line-height:1.5;direction:rtl;text-align:right;word-break:break-word;white-space:pre-wrap;overflow-wrap:anywhere;cursor:text;pointer-events:all;"></div>
      <span class="shape-sel-indicator" style="display:none;position:absolute;inset:-3px;border:2px dashed #e8a020;border-radius:${radius+2}px;pointer-events:none;"></span>
    </div><span data-object-caret="${id}">\u200B</span>`)
    setTimeout(()=>{
      initShapeInteraction(id)
      const box=document.getElementById(id)
      const text=box?.querySelector(".shape-text")
      if(!text)return
      text.contentEditable="true";text.style.pointerEvents="all";text.focus()
      const range=document.createRange();range.selectNodeContents(text);range.collapse(false)
      const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
      savedRangeRef.current=range.cloneRange()
      activePgRef.current=pagesRef.current.find(page=>page?.contains(box))||activePgRef.current
    },80)
  }

  function insertHorizontalLine(){
    const id=`horizontal_line_${Date.now()}`
    exec("insertHTML",`<div id="${id}" data-horizontal-line="true" contenteditable="false"
      style="display:block;width:100%;clear:both;margin:10px 0 8px;padding:0;">
      <hr style="border:0;border-top:1.5px solid var(--theme-accent1);margin:0;width:100%;"/>
    </div><p data-after-horizontal-line="${id}" style="margin:0;"><br></p>`)
    setTimeout(()=>{
      const line=document.getElementById(id)
      const paragraph=line?.nextElementSibling
      const page=pagesRef.current.find(current=>current?.contains(line))
      if(!paragraph||!page)return
      page.focus({preventScroll:true})
      const range=document.createRange();range.selectNodeContents(paragraph);range.collapse(true)
      const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
      savedRangeRef.current=range.cloneRange();activePgRef.current=page
      requestAnimationFrame(()=>spillCheck())
    },0)
  }

  // ── WordArt state & open ──────────────────────────────────────────────────


  // ── Cover Page state & open ───────────────────────────────────────────────
  const [showCoverPage,setShowCoverPage]=useState(false)
  function openCoverPage(){setShowCoverPage(true)}

  function markManualPageStart(html,kind){
    const holder=document.createElement("div")
    holder.innerHTML=html||""
    let first=holder.firstElementChild
    if(!first){
      first=document.createElement("p")
      first.innerHTML="<br>"
      holder.appendChild(first)
    }
    first.setAttribute("data-manual-page-start",kind)
    return holder.innerHTML
  }

  function insertPhysicalPage(blankPage=false){
    restoreSelection()
    const selection=window.getSelection()
    if(!selection||!selection.rangeCount)return
    const range=selection.getRangeAt(0)
    const pages=pagesRef.current.filter(Boolean)
    const page=pages.find(pg=>pg&&pg.contains(range.startContainer))
    if(!page)return
    const pageIndex=pages.indexOf(page)
    saveHistory()

    // Split at the real caret. Everything after it is preserved, including
    // spans, lists, images and paragraph formatting.
    const tailRange=document.createRange()
    tailRange.setStart(range.startContainer,range.startOffset)
    tailRange.setEnd(page,page.childNodes.length)
    const tailHolder=document.createElement("div")
    tailHolder.appendChild(tailRange.extractContents())
    const tailHasContent=(tailHolder.textContent||"").replace(/\u200B/g,"").trim()
      ||tailHolder.querySelector("img,table,ul,ol,[data-shape],[data-chart]")

    const beforePages=pages.slice(0,pageIndex).map(pg=>pg.innerHTML)
    const afterPages=pages.slice(pageIndex+1).map(pg=>pg.innerHTML)
    const inserted=[]
    if(blankPage)inserted.push('<p data-manual-page-start="blank"><br></p>')
    if(!blankPage||tailHasContent){
      inserted.push(markManualPageStart(tailHolder.innerHTML,blankPage?"blank-end":"break"))
    }
    const htmlPages=[...beforePages,page.innerHTML,...inserted,...afterPages]

    flushSync(()=>setPageCount(htmlPages.length))
    htmlPages.forEach((html,index)=>{
      if(pagesRef.current[index])pagesRef.current[index].innerHTML=html
    })
    const targetIndex=pageIndex+1
    const target=pagesRef.current[targetIndex]
    focusPageCaret(target,false)
    dirtyRef.current=true
    updateStats()
    pendingSpillCursorRef.current=null
    showToast(blankPage?"Blank A4 page inserted ✓":"Page break inserted ✓")
  }

  function insertBlankPage(){insertPhysicalPage(true)}
  function insertPageBreak(){insertPhysicalPage(false)}

  function pageHasMeaningfulContent(page){
    if(!page)return false
    return Array.from(page.childNodes).some(node=>{
      if(node.nodeType===3)return !!node.textContent.replace(/\u200B/g,"").trim()
      if(node.nodeType!==1)return false
      const element=node
      const text=(element.textContent||"").replace(/\u200B/g,"").trim()
      return !!text
        ||element.matches("img,table,[data-shape],[data-chart],[data-textbox],hr")
        ||!!element.querySelector("img,table,[data-shape],[data-chart],[data-textbox],hr")
    })
  }

  function focusPageLastWrittenCaret(page){
    if(!page)return
    page.focus({preventScroll:true})
    const walker=document.createTreeWalker(
      page,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode:node=>(node.textContent||"").replace(/\u200B/g,"").trim()
          ?NodeFilter.FILTER_ACCEPT
          :NodeFilter.FILTER_REJECT
      }
    )
    let lastText=null
    for(let node=walker.nextNode();node;node=walker.nextNode())lastText=node

    const range=document.createRange()
    if(lastText)range.setStart(lastText,lastText.textContent.length)
    else{
      const objects=page.querySelectorAll(
        "img,table,[data-shape],[data-chart],[data-textbox],hr"
      )
      const lastObject=objects[objects.length-1]
      if(lastObject)range.setStartAfter(lastObject)
      else{range.selectNodeContents(page);range.collapse(false)}
    }
    range.collapse(true)
    const selection=window.getSelection()
    selection?.removeAllRanges();selection?.addRange(range)
    savedRangeRef.current=range.cloneRange()
    activePgRef.current=page
  }

  function removeBlankDocumentPage(pageIndex,caretSide="previous"){
    const pages=pagesRef.current.filter(Boolean)
    const page=pages[pageIndex]
    if(!page||pages.length<=1||pageHasMeaningfulContent(page))return false

    saveHistory()
    const usePrevious=caretSide==="previous"&&pageIndex>0
    const targetIndex=usePrevious?pageIndex-1:Math.min(pageIndex,pages.length-2)
    for(let index=pageIndex;index<pages.length-1;index++){
      pages[index].replaceChildren(...Array.from(pages[index+1].childNodes))
    }
    flushSync(()=>setPageCount(count=>Math.max(1,count-1)))

    const target=pagesRef.current[targetIndex]
    if(usePrevious)focusPageLastWrittenCaret(target)
    else focusPageCaret(target,false)
    pendingSpillCursorRef.current=null
    dirtyRef.current=true
    updateStats()
    // Store both sides of the structural edit so Undo restores the page.
    saveHistory()
    requestAnimationFrame(()=>spillCheck())
    return true
  }

  function removeManualPageBoundary(pageIndex){
    const pages=pagesRef.current.filter(Boolean)
    const page=pages[pageIndex]
    const previous=pages[pageIndex-1]
    if(!page||!previous)return false
    const first=Array.from(page.childNodes)
      .find(node=>node.nodeType===1||(node.nodeType===3&&node.textContent.trim()))
    if(!first||first.nodeType!==1||!first.hasAttribute("data-manual-page-start"))return false

    saveHistory()
    const kind=first.getAttribute("data-manual-page-start")
    first.removeAttribute("data-manual-page-start")
    let joinNode=null
    if(kind!=="blank"){
      joinNode=page.firstChild
      previous.append(...Array.from(page.childNodes))
    }
    for(let index=pageIndex;index<pages.length-1;index++){
      pages[index].replaceChildren(...Array.from(pages[index+1].childNodes))
    }
    flushSync(()=>setPageCount(count=>Math.max(1,count-1)))

    if(kind==="blank")focusPageLastWrittenCaret(previous)
    else{
      previous.focus({preventScroll:true})
      const range=document.createRange()
      if(joinNode&&previous.contains(joinNode))range.setStartBefore(joinNode)
      else{range.selectNodeContents(previous);range.collapse(false)}
      range.collapse(true)
      const selection=window.getSelection()
      selection?.removeAllRanges();selection?.addRange(range)
      savedRangeRef.current=range.cloneRange()
      activePgRef.current=previous
    }
    dirtyRef.current=true
    updateStats()
    requestAnimationFrame(()=>spillCheck())
    return true
  }

  function insertCoverPageHTML(html){
    const pages=pagesRef.current.filter(Boolean)
    if(!pages.length)return
    saveHistory()
    const existing=pages.map(pg=>pg.innerHTML)
    if(existing.length)existing[0]=markManualPageStart(existing[0],"cover-end")
    const htmlPages=[`<div data-cover-page="true">${html}</div>`,...existing]
    flushSync(()=>setPageCount(htmlPages.length))
    htmlPages.forEach((pageHTML,index)=>{
      if(pagesRef.current[index])pagesRef.current[index].innerHTML=pageHTML
    })
    focusPageCaret(pagesRef.current[1]||pagesRef.current[0],false)
    dirtyRef.current=true
    updateStats()
    showToast("Cover page inserted ✓")
  }
  function applyFontSize(size){saveHistory();applySpanStyle("fontSize",size+"px");dirtyRef.current=true;setTimeout(()=>spillCheck(),0)}
  function applyFontFamily(fam){saveHistory();applySpanStyle("fontFamily",fam);dirtyRef.current=true}

  const updateStats=useCallback(()=>{
    const stats=calculateDocumentTextStats(
      pagesRef.current.filter(Boolean).map(extractEditorPageText),
      pageCount
    )
    setWordCount(stats.words)
    setCharCount(stats.charactersWithSpaces)
    setCharCountNoSpaces(stats.charactersWithoutSpaces)
    setParagraphCount(stats.paragraphs)
    return stats
  },[pageCount])

  function showWordCountDialog(){
    const stats=updateStats()
    showModal({
      type:"info",
      title:"Word Count",
      message:`<div style="display:grid;grid-template-columns:1fr auto;gap:8px 28px;min-width:260px;text-align:left">
        <span>Pages</span><b>${stats.pages}</b>
        <span>Words</span><b>${stats.words}</b>
        <span>Characters (no spaces)</span><b>${stats.charactersWithoutSpaces}</b>
        <span>Characters (with spaces)</span><b>${stats.charactersWithSpaces}</b>
        <span>Paragraphs</span><b>${stats.paragraphs}</b>
      </div>`,
      onConfirm:closeModal,
    })
  }

  // ── Kashmiri Spell Check ─────────────────────────────────────────────────
  // Core Kashmiri words (common vocabulary)
  const KASHUR_DICT = new Set([
    // Common Kashmiri words
    "چھُ","چھِ","چھے","آسہٕ","کر","کرو","کران","کرِتھ","گوو","گئے","گژھو","وۆنۍ","وَنان",
    "تہٕ","تَہٕ","یِمہٕ","یِتھ","یَم","یَتھ","ہیٚکہٕ","ہیٚکِو","اَکھ","دوٚیِم","پانہٕ",
    "زِ","یُس","یۄس","تام","ہِتۍ","کُس","کیا","کِتھ","کیاز","ہیٕتۍ","مگر","البتہ",
    "اَمہٕ","تِمہٕ","سۄ","سِہ","مے","تۄہہ","ہیوٕ","ہیوٕس","اَسہٕ","وُچھ","وُچھُن",
    "لیکھ","لیکھن","پڑھ","پڑھن","خوش","خوشی","دل","دلہٕ","جان","جانہٕ","وقت",
    "کام","کامہٕ","زبان","کشمیری","کشمیر","اللہ","محمد","اسلام","مسلمان",
    "گھر","گھرہٕ","راتھ","دوہ","شاہ","پادشاہ","وزیر","ملک","دیش","لوک",
    "پانی","آگ","مٹی","اسمان","ہاوا","درخت","پھُل","پھل","بیجی","بیج",
    "ہاتھ","پیر","آنکھ","کان","ناک","منہ","دِل","جان","روح","بدن",
    "ماتر","پیتر","بھاے","بینہ","پوش","پوشہٕ","کُڈ","کُڈہٕ","تُلہٕ","ژیم",
    "بسم","الرحمن","الرحیم","بسم اللہ","یہ","ہے","کا","کی","کے","میں","اور",
    "سے","پر","کو","نے","ہی","بھی","تو","جو","جب","کب","کیسے","کیوں",
  ])

  function runSpellCheck(){
    if(true) return // removed per supervisor
    pagesRef.current.filter(Boolean).forEach(pg=>{
      // Walk text nodes and wrap unknown Kashmiri words
      const walker=document.createTreeWalker(pg,NodeFilter.SHOW_TEXT,{
        acceptNode:n=>{
          // Skip nodes inside spell-mark, shape, script, style
          const p=n.parentElement
          if(!p) return NodeFilter.FILTER_REJECT
          if(["SCRIPT","STYLE","MARK"].includes(p.tagName)) return NodeFilter.FILTER_REJECT
          if(p.classList?.contains("spell-err")) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        }
      },false)
      const nodes=[]; let n
      while((n=walker.nextNode())) nodes.push(n)
      nodes.forEach(textNode=>{
        const text=textNode.nodeValue; if(!text||!text.trim()) return
        // Kashmiri words are RTL Unicode — split on spaces/punctuation
        const parts=text.split(/([\s\u060c\u061b\u06d4\u061f!.,;:\n\t]+)/)
        if(parts.length<=1) return
        let changed=false
        const frag=document.createDocumentFragment()
        parts.forEach(part=>{
          if(!part.trim()||/^[\s\u060c\u061b\u06d4\u061f!.,;:\n\t]+$/.test(part)){
            frag.appendChild(document.createTextNode(part)); return
          }
          // Check if this looks like a Kashmiri word (has Arabic/Urdu script)
          const isKashur=/\p{Script=Arabic}/u.test(part)
          if(isKashur&&!KASHUR_DICT.has(part)){
            const mark=document.createElement("span")
            mark.className="spell-err"
            mark.style.cssText="border-bottom:2px solid #e74c3c;cursor:pointer;"
            mark.title="ممکن غلطی — Possible spelling error"
            mark.textContent=part
            frag.appendChild(mark); changed=true
          } else {
            frag.appendChild(document.createTextNode(part))
          }
        })
        if(changed&&textNode.parentNode) textNode.parentNode.replaceChild(frag,textNode)
      })
    })
  }

  function clearSpellCheck(){
    pagesRef.current.filter(Boolean).forEach(pg=>{
      pg.querySelectorAll(".spell-err").forEach(el=>{
        el.parentNode?.replaceChild(document.createTextNode(el.textContent),el)
        el.parentNode?.normalize()
      })
    })
  }

  useEffect(()=>{
    // spell check removed per supervisor requirement
  },[])

  // ── PAGE ENGINE — reliable word-level overflow detection ─────────────────
  // Save one document-wide caret position before pagination. Also retain the
  // direct paragraph/block containing it; moved blocks keep this identity.
  function getCursorPos(){
    const sel=window.getSelection(); if(!sel||sel.rangeCount===0) return null
    const range=sel.getRangeAt(0)
    if(!range.collapsed)return null
    const pg=pagesRef.current.find(p=>p&&p.contains(range.startContainer)); if(!pg) return null
    try{
      const preCaretRange=document.createRange()
      preCaretRange.selectNodeContents(pg)
      preCaretRange.setEnd(range.startContainer,range.startOffset)
      let offset=preCaretRange.toString().length
      const pgIdx=pagesRef.current.indexOf(pg)
      for(let i=0;i<pgIdx;i++){
        const pageRange=document.createRange()
        pageRange.selectNodeContents(pagesRef.current[i])
        offset+=pageRange.toString().length
      }
      let block=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement
      const caretElement=range.startContainer.nodeType===1
        ?range.startContainer
        :range.startContainer.parentElement
      const leaf=caretElement?.closest?.("li")
      let leafOffset=0
      if(leaf&&pg.contains(leaf)){
        const leafRange=document.createRange()
        leafRange.selectNodeContents(leaf)
        leafRange.setEnd(range.startContainer,range.startOffset)
        leafOffset=leafRange.toString().length
      }
      while(block&&block.parentElement!==pg)block=block.parentElement
      let blockOffset=0
      if(block){
        const blockRange=document.createRange()
        blockRange.selectNodeContents(block)
        blockRange.setEnd(range.startContainer,range.startOffset)
        blockOffset=blockRange.toString().length
      }
      return {offset,block,blockOffset,leaf:leaf&&pg.contains(leaf)?leaf:null,leafOffset}
    }catch{return null}
  }
  function restoreCursorPos(pos){
    if(!pos) return
    try{
      let targetPage=null,range=document.createRange()

      // An empty new LI can have the same text offset as the end of the
      // preceding LI. Preserve its exact DOM identity so Enter never restores
      // the caret to the previous bullet.
      if(pos.leaf?.isConnected){
        targetPage=pagesRef.current.find(p=>p&&p.contains(pos.leaf))
        const walker=document.createTreeWalker(pos.leaf,NodeFilter.SHOW_TEXT)
        let chars=0,node=walker.nextNode(),placed=false
        while(node){
          const len=node.textContent.length
          if(chars+len>=pos.leafOffset){
            range.setStart(node,Math.min(pos.leafOffset-chars,len));placed=true;break
          }
          chars+=len;node=walker.nextNode()
        }
        if(!placed){range.selectNodeContents(pos.leaf);range.collapse(true)}
      // Prefer the original paragraph/block when it was moved to a new page.
      }else if(pos.block?.isConnected){
        targetPage=pagesRef.current.find(p=>p&&p.contains(pos.block))
        const walker=document.createTreeWalker(pos.block,NodeFilter.SHOW_TEXT)
        let chars=0,node=walker.nextNode(),placed=false
        while(node){
          const len=node.textContent.length
          if(chars+len>=pos.blockOffset){
            range.setStart(node,Math.min(pos.blockOffset-chars,len));placed=true;break
          }
          chars+=len;node=walker.nextNode()
        }
        if(!placed){range.selectNodeContents(pos.block);range.collapse(false)}
      }else{
        let remaining=pos.offset
        for(const pg of pagesRef.current.filter(Boolean)){
          const pageRange=document.createRange();pageRange.selectNodeContents(pg)
          const length=pageRange.toString().length
          if(remaining<=length){
            targetPage=pg
            const walker=document.createTreeWalker(pg,NodeFilter.SHOW_TEXT)
            let chars=0,node=walker.nextNode(),placed=false
            while(node){
              const len=node.textContent.length
              if(chars+len>=remaining){
                range.setStart(node,Math.min(remaining-chars,len));placed=true;break
              }
              chars+=len;node=walker.nextNode()
            }
            if(!placed){range.selectNodeContents(pg);range.collapse(false)}
            break
          }
          remaining-=length
        }
      }

      targetPage=targetPage||pagesRef.current.filter(Boolean).slice(-1)[0]
      if(!targetPage)return
      range.collapse(true)
      targetPage.focus({preventScroll:true})
      const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range)
      savedRangeRef.current=range.cloneRange();activePgRef.current=targetPage
    }catch(e){}
  }

  function textBoundaryAt(root,charOffset){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT)
    let remaining=Math.max(0,charOffset),node=walker.nextNode(),last=null
    while(node){
      last=node
      const length=node.textContent.length
      if(remaining<=length)return {node,offset:remaining}
      remaining-=length
      node=walker.nextNode()
    }
    return last?{node:last,offset:last.textContent.length}:null
  }

  // Split a long list between A4 sheets one LI at a time. Keeping real list
  // elements preserves bullets, nested levels, and ordered-list continuation.
  function splitOverflowList(list,next){
    if(!list||!next||!["UL","OL"].includes(list.tagName))return false
    const item=list.lastElementChild
    if(!item||item.tagName!=="LI")return false

    let continuation=next.firstElementChild
    const sameContinuation=continuation
      &&continuation.tagName===list.tagName
      &&continuation.getAttribute("data-list-continuation")==="1"
      &&continuation.getAttribute("data-list-source")===list.getAttribute("data-list-source")

    if(!sameContinuation){
      if(!list.getAttribute("data-list-source")){
        list.setAttribute("data-list-source",`list_${Date.now()}_${Math.random().toString(36).slice(2)}`)
      }
      continuation=list.cloneNode(false)
      continuation.setAttribute("data-list-continuation","1")
      continuation.setAttribute("data-list-source",list.getAttribute("data-list-source"))
      next.insertBefore(continuation,next.firstChild)
    }

    const movedLength=(item.textContent||"").length
    const pending=pendingSpillCursorRef.current
    const remainingLength=Math.max(0,(list.textContent||"").length-movedLength)
    if(pending?.block===list&&pending.blockOffset>remainingLength){
      pending.block=continuation
      pending.blockOffset-=remainingLength
    }else if(pending?.block===continuation){
      pending.blockOffset+=movedLength
    }

    continuation.insertBefore(item,continuation.firstChild)
    if(list.tagName==="OL"){
      const first=Number.parseInt(list.getAttribute("start")||"1",10)||1
      continuation.setAttribute("start",String(first+list.children.length))
      if(list.hasAttribute("data-multilevel")&&list.getAttribute("data-multilevel")!=="mixed"){
        const base=Number.parseInt(list.getAttribute("data-counter-base")||"0",10)||0
        const continuationBase=base+list.children.length
        continuation.setAttribute("data-counter-base",String(continuationBase))
        continuation.style.counterReset=`word-level ${continuationBase}`
      }
    }
    if(!list.children.length)list.remove()
    return true
  }

  // Split a text paragraph at the last rendered character that fits inside
  // the current A4 page. The extracted tail keeps its nested spans and inline
  // formatting and becomes the first paragraph on the following page.
  function splitOverflowBlock(block,next,pageBottom){
    if(!block||block.nodeType!==1||!next)return false
    if(!["P","DIV","H1","H2","H3","H4","H5","H6","BLOCKQUOTE","PRE"].includes(block.tagName))return false
    if(block.hasAttribute("data-shape")||block.getAttribute("contenteditable")==="false")return false
    const text=block.textContent||""
    if(text.length<2||block.getBoundingClientRect().top>=pageBottom)return false

    function prefixFits(count){
      const boundary=textBoundaryAt(block,count)
      if(!boundary)return false
      const probe=document.createRange()
      probe.selectNodeContents(block)
      probe.setEnd(boundary.node,boundary.offset)
      const rects=probe.getClientRects()
      if(!rects.length)return true
      return rects[rects.length-1].bottom<=pageBottom+1
    }

    let low=1,high=text.length-1,best=0
    while(low<=high){
      const mid=Math.floor((low+high)/2)
      if(prefixFits(mid)){best=mid;low=mid+1}
      else high=mid-1
    }
    if(best<=0||best>=text.length)return false

    // Prefer a nearby word boundary, but never choose one so far back that it
    // leaves a visibly large unused area at the bottom of the page.
    const before=text.slice(0,best)
    const wordBreak=Math.max(before.lastIndexOf(" "),before.lastIndexOf("\n"),before.lastIndexOf("\t"))
    const cut=wordBreak>best*.7?wordBreak+1:best
    const boundary=textBoundaryAt(block,cut)
    if(!boundary)return false

    const tailRange=document.createRange()
    tailRange.setStart(boundary.node,boundary.offset)
    tailRange.setEnd(block,block.childNodes.length)
    const tail=tailRange.extractContents()
    const continuation=block.cloneNode(false)
    continuation.removeAttribute("id")
    continuation.removeAttribute("data-click-flow")
    continuation.style.marginTop="0"
    continuation.appendChild(tail)
    if(!continuation.childNodes.length)continuation.innerHTML="<br>"
    next.insertBefore(continuation,next.firstChild)

    const pending=pendingSpillCursorRef.current
    if(pending?.block===block&&pending.blockOffset>cut){
      pending.block=continuation
      pending.blockOffset-=cut
    }
    return true
  }

  const spillCheck=useCallback(()=>{
    let pgs=pagesRef.current.filter(Boolean)
    if(!pgs.length) return
    const cursorPos=pendingSpillCursorRef.current||getCursorPos()
    if(cursorPos)pendingSpillCursorRef.current=cursorPos

    // ── FORWARD: push overflow from each page to the next ─────────────────
    for(let i=0;i<pgs.length;i++){
      const pg=pgs[i]
      if(pg.scrollHeight<=pg.clientHeight+2) continue   // no overflow, skip

      // Ensure next page exists
      if(!pgs[i+1]){
        // Mount the next A4 sheet in the same input event. Previously this
        // waited for two animation frames, leaving newly typed text clipped
        // below the current page and making Enter/Backspace feel delayed.
        flushSync(()=>setPageCount(c=>Math.max(c,i+2)))
        pgs=pagesRef.current.filter(Boolean)
        // A defensive fallback for unusual concurrent renders; normal React
        // DOM rendering reaches the synchronous branch above.
        if(!pgs[i+1]){
          requestAnimationFrame(()=>spillCheck())
          return
        }
      }

      // Move block-level children one at a time until page fits
      let safety=0
      while(pg.scrollHeight>pg.clientHeight+2 && safety++<300){
        const kids=Array.from(pg.childNodes)
          .filter(n=>!(n.nodeType===3&&!n.textContent.trim()))

        const last=kids[kids.length-1]
        const pgStyle=getComputedStyle(pg)
        const pageBottom=pg.getBoundingClientRect().bottom-(parseFloat(pgStyle.paddingBottom)||0)*zoom

        if(splitOverflowList(last,pgs[i+1]))continue
        // Unlike the old whole-block-only engine, split a long final paragraph
        // so its visible prefix remains on this page and its tail continues on
        // page 2 instead of being clipped by overflow:hidden.
        if(splitOverflowBlock(last,pgs[i+1],pageBottom))continue
        if(kids.length<=1)break   // non-text object too large to split safely

        if(last.nodeType===1){
          // A click-and-type paragraph may carry a large top margin to reach
          // the clicked position. Once it flows to another A4 page, that gap
          // must disappear so the paragraph starts on page 2's first line.
          if(last.hasAttribute("data-click-flow")){
            last.style.marginTop="0"
            last.removeAttribute("data-click-flow")
          }
          // Enter after centred/right/left text can create an empty paragraph
          // that inherits that alignment. At an automatic page boundary the
          // new empty paragraph starts with the page's normal writing alignment.
          const empty=!(last.textContent||"").replace(/\u200B/g,"").trim()
          if(empty){
            last.style.textAlign=pg.style.textAlign||"right"
            last.style.direction=pg.style.direction||"rtl"
            last.style.marginTop="0"
            last.style.paddingLeft="0"
            last.style.paddingRight="0"
            last.style.width=""
          }
        }
        pgs[i+1].insertBefore(last, pgs[i+1].firstChild)
      }
    }

    // ── BACKWARD: pull up first child of next page if prev has room ────────
    for(let i=pgs.length-2;i>=0;i--){
      const pg=pgs[i], next=pgs[i+1]
      if(!next) continue
      const firstChild=Array.from(next.childNodes)
        .find(n=>n.nodeType===1||(n.nodeType===3&&n.textContent.trim()))
      if(!firstChild) continue
      // A manual Page Break, Blank Page or Cover Page is an intentional A4
      // boundary. Do not pull its content backward into the previous sheet.
      if(firstChild.nodeType===1&&firstChild.hasAttribute("data-manual-page-start"))continue
      // Try appending
      const originalNext=firstChild.nextSibling
      pg.appendChild(firstChild)
      if(pg.scrollHeight<=pg.clientHeight+2){
        // If next page now empty and it's the last, remove it
        const remaining=Array.from(next.childNodes).filter(n=>n.nodeType===1||(n.nodeType===3&&n.textContent.trim()))
        if(remaining.length===0&&i+1===pgs.length-1){
          // React is about to unmount `next`. If the live caret still belongs
          // to that page/root, the browser otherwise loses its selection and
          // commonly recreates it at the first line of page 1. Move the caret
          // to the Word-like continuation point first: the end of the
          // preceding page (which now also contains the pulled-up content).
          const selection=window.getSelection()
          const liveRange=selection?.rangeCount?selection.getRangeAt(0):null
          if(liveRange?.collapsed&&next.contains(liveRange.startContainer)){
            focusPageCaret(pg,true)
          }

          // Store the valid document-wide position before the old page DOM is
          // removed, then unmount synchronously so selectionchange cannot save
          // a temporary browser fallback range at page 1's beginning.
          pendingSpillCursorRef.current=getCursorPos()
            ||{offset:(pg.textContent||"").length,block:null,blockOffset:0}
          flushSync(()=>setPageCount(c=>Math.max(1,c-1)))
        }
      } else {
        // Doesn't fit — move the original node back where it came from.
        next.insertBefore(firstChild,originalNext)
      }
    }

    updateStats()
    if(pendingSpillCursorRef.current){
      restoreCursorPos(pendingSpillCursorRef.current)
      pendingSpillCursorRef.current=null
    }
  },[updateStats,setPageCount])

  function changePageOrientation(nextOrientation){
    if(!A4[nextOrientation]||nextOrientation===orientation)return
    saveHistory()
    // Preserve the exact logical document position while every page changes
    // from 210×297 mm to 297×210 mm (or back).
    pendingSpillCursorRef.current=getCursorPos()
    flushSync(()=>setOrientation(nextOrientation))
    dirtyRef.current=true
    // React has now applied the new page width and height. Rebalance all
    // blocks immediately so no text remains clipped on the shorter
    // landscape page, and pull content back when returning to portrait.
    requestAnimationFrame(()=>{
      spillCheck()
      requestAnimationFrame(()=>spillCheck())
    })
    showToast(nextOrientation==="landscape"
      ?"A4 Landscape applied to the whole document"
      :"A4 Portrait applied to the whole document")
  }
  function changePageMargins(preset){
    if(!preset)return
    const next={
      top:Number(preset.top)||0,bottom:Number(preset.bottom)||0,
      left:Number(preset.left)||0,right:Number(preset.right)||0,
      id:preset.id||"custom",
    }
    if(["top","bottom","left","right"].every(side=>pageMargins[side]===next[side]))return
    saveHistory()
    pendingSpillCursorRef.current=getCursorPos()
    flushSync(()=>setPageMargins(next))
    dirtyRef.current=true
    requestAnimationFrame(()=>{
      spillCheck()
      requestAnimationFrame(()=>spillCheck())
    })
    showToast(`${preset.name||"Page"} margins applied to the whole document`)
  }

  function paintDocumentTheme(page,name){
    if(!page)return
    const selectedName=DOCUMENT_THEMES[name]?name:"Office"
    const selected=DOCUMENT_THEMES[selectedName]
    page.setAttribute("data-document-theme",selectedName)
    page.style.setProperty("--theme-text",selected.text)
    page.style.setProperty("--theme-muted",selected.muted)
    page.style.setProperty("--theme-accent1",selected.accent1)
    page.style.setProperty("--theme-accent2",selected.accent2)
    page.style.setProperty("--theme-accent3",selected.accent3)
    page.style.setProperty("--theme-heading-font",selected.headingFont)
    page.style.setProperty("--theme-body-font",selected.bodyFont)

    // Normal paragraphs use the theme body font and text colour. Fonts or
    // colours explicitly applied to a paragraph/span stay untouched.
    page.querySelectorAll("p,li,td,:scope > div:not([data-shape])").forEach(block=>{
      if(block.closest("[data-shape]"))return
      if(!block.style.fontFamily||block.style.fontFamily.includes("--theme-body-font"))
        block.style.fontFamily="var(--theme-body-font)"
      if(!block.style.color||block.style.color.includes("--theme-text"))
        block.style.color="var(--theme-text)"
    })
    page.querySelectorAll("h1,[data-word-style='h1']").forEach(block=>{
      block.style.color="var(--theme-accent1)"
      block.style.fontFamily="var(--theme-heading-font)"
      if(block.style.borderBottomStyle&&block.style.borderBottomStyle!=="none")
        block.style.borderBottomColor="var(--theme-accent1)"
    })
    page.querySelectorAll("h2,[data-word-style='h2'],[data-word-style='numbered']").forEach(block=>{
      block.style.color="var(--theme-accent1)"
      block.style.fontFamily="var(--theme-heading-font)"
    })
    page.querySelectorAll("h3,[data-word-style='h3']").forEach(block=>{
      block.style.color="var(--theme-accent2)"
      block.style.fontFamily="var(--theme-heading-font)"
    })
    page.querySelectorAll("h4,[data-word-style='h4']").forEach(block=>{
      block.style.color="var(--theme-muted)"
      block.style.fontFamily="var(--theme-heading-font)"
    })
    page.querySelectorAll("[data-word-style='subtitle']").forEach(block=>{
      block.style.color="var(--theme-muted)"
    })
    page.querySelectorAll("blockquote,[data-word-style='blockquote']").forEach(block=>{
      block.style.color="var(--theme-muted)"
      block.style.borderColor="var(--theme-accent1)"
    })
    page.querySelectorAll("a[data-word-link='true'],a[data-toc-link]").forEach(link=>{
      link.style.color="var(--theme-accent1)"
    })
    page.querySelectorAll("table th").forEach(cell=>{
      cell.style.backgroundColor="var(--theme-accent1)"
      cell.style.color="#ffffff"
    })
    page.querySelectorAll("hr").forEach(rule=>{
      rule.style.borderTopColor="var(--theme-accent1)"
    })
  }

  function applyDocumentTheme(name,{recordHistory=true,notify=true,preview=false}={}){
    const selectedName=DOCUMENT_THEMES[name]?name:"Office"
    const selected=DOCUMENT_THEMES[selectedName]
    if(recordHistory)saveHistory()
    setTheme(selectedName)
    setPageColor(selected.page)
    pagesRef.current.filter(Boolean).forEach(page=>{
      page.style.background=selected.page
      paintDocumentTheme(page,selectedName)
    })
    if(!preview)dirtyRef.current=true
    requestAnimationFrame(()=>{
      spillCheck()
      requestAnimationFrame(()=>spillCheck())
    })
    if(notify)showToast(`${selectedName} document theme applied`)
  }

  function applyDocumentPageColor(color,{recordHistory=true,notify=true,preview=false}={}){
    const selected=/^#[0-9a-f]{6}$/i.test(String(color||""))?color:"#ffffff"
    if(recordHistory)saveHistory()
    setPageColor(selected)
    pagesRef.current.filter(Boolean).forEach(page=>{page.style.background=selected})
    if(!preview)dirtyRef.current=true
    if(notify)showToast(selected.toLowerCase()==="#ffffff"
      ?"Page colour removed"
      :"Page colour applied to every page")
  }

  function applyDocumentPageBorder(config,{recordHistory=true,notify=true}={}){
    const setting=["none","box","shadow","3d","custom"].includes(config?.setting)
      ?config.setting
      :"none"
    const style=["solid","double","dashed","dotted","groove","ridge"].includes(config?.style)
      ?config.style
      :"solid"
    const width=Math.max(.5,Math.min(12,Number(config?.width)||1))
    const color=/^#[0-9a-f]{6}$/i.test(String(config?.color||""))
      ?config.color
      :"#2b579a"
    const sides={
      top:config?.sides?.top!==false,right:config?.sides?.right!==false,
      bottom:config?.sides?.bottom!==false,left:config?.sides?.left!==false,
    }
    if(recordHistory)saveHistory()
    setPageBorderSetting(setting)
    setPageBorderStyle(setting==="none"?"none":style)
    setPageBorderWidth(width)
    setPageBorderColor(color)
    setPageBorderSides(sides)
    dirtyRef.current=true
    if(notify)showToast(setting==="none"
      ?"Page border removed"
      :"Page border applied to every page")
  }

  function applyDocumentWatermark(config,{recordHistory=true,notify=true,preview=false}={}){
    const text=String(config?.text||"").trim().slice(0,80)
    const next={
      type:config?.type==="text"&&text?"text":"none",
      text,
      font:String(config?.font||"'Segoe UI', Arial, sans-serif"),
      size:Math.max(24,Math.min(120,Number(config?.size)||56)),
      color:/^#[0-9a-f]{6}$/i.test(String(config?.color||""))
        ?config.color
        :"#b8b8b8",
      opacity:Math.max(.05,Math.min(.8,Number(config?.opacity)||.28)),
      layout:config?.layout==="horizontal"?"horizontal":"diagonal",
    }
    if(recordHistory)saveHistory()
    setWatermark(next)
    if(!preview)dirtyRef.current=true
    if(notify)showToast(next.type==="none"
      ?"Watermark removed"
      :"Watermark applied to every page")
  }

  function getAllHTML(){
    // Force any pending overflow to settle before we read the DOM, so what
    // gets saved always matches what's balanced on screen — not whatever
    // state existed before the 400ms debounce fired.
    clearTimeout(spillTimer.current)
    spillCheck()
    const settings=encodeURIComponent(JSON.stringify({
      theme,pageColor,pageBorderStyle,pageBorderWidth,pageBorderColor,
      pageBorderSetting,pageBorderSides,watermark,
      comments,trackChanges,changes,
    }))
    return pagesRef.current.filter(Boolean).map((page,index)=>
      `${index===0?`<!-- KASHUR_SETTINGS:${settings} -->`:""}${page.innerHTML}`
    ).join("\n<!-- PAGE_BREAK -->\n")
  }
  function changeDocumentTitle(value){
    const next=String(value??"").slice(0,120)
    setDocTitle(next)
    docTitleRef.current=next
    dirtyRef.current=true
    showSaveStatus("Unsaved changes",0)
  }
  function commitDocumentTitle(){
    const next=String(docTitleRef.current||"").trim()
    if(!next){
      showSaveStatus("⚠ Title required",0)
      return false
    }
    if(next!==docTitleRef.current||next!==docTitle){
      docTitleRef.current=next
      setDocTitle(next)
    }
    return true
  }
  async function saveNow(silentArg=false){
    const silent=silentArg===true
    if(saveInFlightRef.current){
      if(!silent)showSaveStatus("Saving…",0)
      return false
    }
    const title=String(docTitleRef.current||"").trim()
    if(!title){
      showSaveStatus("⚠ Title required",0)
      if(!silent)showModal({
        type:"warn",title:"Document Title Required",
        message:"Enter a document title before saving.",
        onConfirm:closeModal,
      })
      return false
    }
    if(title!==docTitleRef.current||title!==docTitle){
      docTitleRef.current=title
      setDocTitle(title)
    }
    saveInFlightRef.current=true
    if(!silent)setSaving(true)
    try{
      const html=getAllHTML(),id=docIdRef.current
      const res=await authFetch(id?`/documents/${id}`:"/documents",{method:id?"PUT":"POST",body:JSON.stringify({
        title,html,pageCount,orientation,pageMargins,
        theme,pageColor,pageBorderStyle,pageBorderWidth,pageBorderColor,
        pageBorderSetting,pageBorderSides,watermark,
        comments,trackChanges,changes,
      })})
      const data=await res.json()
      if(res.status===409){
        const msg=data.error||"Duplicate name."
        showSaveStatus("⚠ Duplicate name",0)
        if(!silent)showModal({type:"warn",title:"Duplicate Name",message:msg,onConfirm:closeModal})
        return false
      }
      if(!res.ok)throw new Error(data.error||"Save failed")
      const newId=data.id||data._id;if(newId){setDocId(newId);docIdRef.current=newId}
      dirtyRef.current=false
      showSaveStatus(silent?"Autosaved ✓":"Saved ✓")
      return true
    }catch(e){
      console.error("Save:",e)
      showSaveStatus("Save failed ✗",0)
      if(!silent)showToast("Save failed: "+e.message,"error")
      return false
    }finally{
      saveInFlightRef.current=false
      if(!silent)setSaving(false)
    }
  }
  saveNowRef.current=saveNow

  async function isTitleTaken(title,excludeId=null){
    try{const res=await authFetch("/documents");const docs=await res.json();return docs.some(d=>d.title.trim().toLowerCase()===title.trim().toLowerCase()&&String(d.id)!==String(excludeId))}catch{return false}
  }

  async function exportDoc(format){
    if(format==="pdf"){spillCheck();doPrintPopup(pagesRef,fontFamily,orientation,headerText,footerText,pageNumber,{setting:pageBorderSetting,style:pageBorderStyle,width:pageBorderWidth,color:pageBorderColor,sides:pageBorderSides},fontSize,lineSpacing,{headerAlign,footerAlign,pageNumberPosition,pageNumberFormat,pageNumberStart},DOCUMENT_THEMES[theme],pageColor,watermark);return}
    if(format==="txt"){const text=pagesRef.current.filter(Boolean).map(p=>p.innerText).join("\n\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));a.download=(docTitleRef.current||"document")+".txt";a.click();URL.revokeObjectURL(a.href);return}
    if(!docIdRef.current)await saveNow(true)
    if(!docIdRef.current){showModal({type:"warn",title:"Save First",message:"Please save before exporting as DOCX.",onConfirm:closeModal});return}
    try{
      setSavedMsg("Preparing DOCX…")
      // Pass font and RTL metadata so backend can apply correct styles
      const res=await authFetch(`/documents/${docIdRef.current}/export/docx`,{
        method:"POST",
        body:JSON.stringify({
          fontFamily,fontSize,lineSpacing,orientation,pageMargins,
          theme,pageColor,themeColors:DOCUMENT_THEMES[theme],
          pageBorder:{setting:pageBorderSetting,style:pageBorderStyle,
            width:pageBorderWidth,color:pageBorderColor,sides:pageBorderSides},
          watermark,
          direction:"rtl",
          title:docTitleRef.current
        })
      })
      if(!res.ok){const err=await res.json().catch(()=>({}));if(err.install)showModal({type:"warn",title:"DOCX Export",message:`${err.error}<br/><code>${err.install}</code>`,onConfirm:closeModal});else showModal({type:"warn",title:"DOCX Export Failed",message:err.error||"Unknown error",onConfirm:closeModal});setSavedMsg("");return}
      const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(docTitleRef.current||"document")+".docx";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);setSavedMsg("")
    }catch(e){showToast("DOCX export failed: "+e.message,"error");setSavedMsg("")}
  }

  function handleRename(){
    showModal({type:"prompt",title:"Rename Document",message:"Enter a new name:",inputDefault:docTitleRef.current,
      onConfirm:async(newName)=>{closeModal();if(!newName||!newName.trim()||newName.trim()===docTitleRef.current)return
        const taken=await isTitleTaken(newName.trim(),docIdRef.current)
        if(taken){showModal({type:"warn",title:"Name Already Taken",message:`"${newName.trim()}" already exists.`,onConfirm:closeModal});return}
        const oldTitle=docTitleRef.current
        setDocTitle(newName.trim());docTitleRef.current=newName.trim();dirtyRef.current=true
        const saved=await saveNow(false)
        if(saved)showToast("Renamed ✓")
        else{setDocTitle(oldTitle);docTitleRef.current=oldTitle;dirtyRef.current=true}
      }
    })
  }

  function requestDocumentTransition(action,title="Unsaved Changes"){
    if(!dirtyRef.current){action();return}
    showModal({
      type:"saveconfirm",title,
      message:`Do you want to save the changes to <b>${String(docTitleRef.current||"Document").replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]))}</b>?`,
      onConfirm:async()=>{
        const saved=await saveNow(false)
        if(saved){closeModal();action()}
      },
      onDiscard:()=>{closeModal();action()},
    })
  }

  function handleBackToDashboard(){
    requestDocumentTransition(()=>onBackToDashboard?.(),"Return to Dashboard")
  }

  function resetToNewDocument(){
    const n=docCounter+1
    setDocCounter(n);setDocTitle(`Document ${n}`);docTitleRef.current=`Document ${n}`
    setDocId(null);docIdRef.current=null
    pagesRef.current.filter(Boolean).forEach((page,index)=>{
      page.innerHTML=index===0?DEFAULT_HTML:""
    })
    setPageCount(1);setComments([]);setChanges([]);setTrackChanges(false)
    setShowComments(false);setActiveCommentId(null)
    dirtyRef.current=false;updateStats();resetHistory()
    requestAnimationFrame(()=>focusPageCaret(pagesRef.current[0]))
  }

  function newDoc(){
    requestDocumentTransition(resetToNewDocument,"Create a New Document")
  }

  async function saveAsDocument(name){
    const next=String(name||"").trim()
    if(!next)return false
    const taken=await isTitleTaken(next)
    if(taken){
      showModal({type:"warn",title:"Name Taken",message:`"${next}" already exists. Choose another name.`,onConfirm:closeModal})
      return false
    }
    const previous={id:docIdRef.current,title:docTitleRef.current,dirty:dirtyRef.current}
    setDocTitle(next);docTitleRef.current=next
    setDocId(null);docIdRef.current=null;dirtyRef.current=true
    const saved=await saveNow(false)
    if(saved){showToast(`Saved a copy as "${next}"`);return true}
    setDocTitle(previous.title);docTitleRef.current=previous.title
    setDocId(previous.id);docIdRef.current=previous.id;dirtyRef.current=previous.dirty
    return false
  }

  function promptSaveAs(){
    showModal({
      type:"prompt",title:"Save As",
      message:"Create a new copy of this document with a different name:",
      inputDefault:docTitleRef.current,
      onConfirm:async name=>{
        closeModal()
        await saveAsDocument(name)
      },
    })
  }

  function showAccountInfo(){
    const escape=value=>String(value??"").replace(/[&<>"]/g,char=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;",
    }[char]))
    const displayName=user?.name||user?.fullName||user?.username||"Kashur Editor User"
    const email=user?.email||"Signed-in account"
    const role=user?.role||"User"
    showModal({
      type:"info",title:"Account Information",
      message:`<div style="display:flex;align-items:center;gap:12px;margin:8px 0 16px">
        <div style="width:48px;height:48px;border-radius:50%;background:#185abd;color:white;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700">${escape(displayName).charAt(0).toUpperCase()}</div>
        <div><b style="font-size:16px">${escape(displayName)}</b><br/><span style="color:#667085">${escape(email)}</span></div>
      </div>
      <div style="border-top:1px solid #e5e7eb;padding-top:12px">
        <b>Product:</b> Kashur Editor<br/>
        <b>Account status:</b> Signed in<br/>
        <b>Role:</b> ${escape(role)}<br/>
        <b>Document:</b> ${escape(docTitleRef.current)}<br/>
        <b>Save status:</b> ${dirtyRef.current?"Unsaved changes":docIdRef.current?"Up to date":"Not saved yet"}
      </div>`,
      onConfirm:closeModal,
    })
  }

  async function openShareDialog(){
    if(shareLoading)return
    setShareLoading(true)
    try{
      if(dirtyRef.current||!docIdRef.current){
        const saved=await saveNow(false)
        if(!saved)return
      }
      const response=await authFetch(`/documents/${docIdRef.current}/share`,{
        method:"PATCH",body:JSON.stringify({isPublic:true}),
      })
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.error||"Could not create a share link")
      const url=data.shareUrl||(data.shareToken
        ?`${window.location.origin}/view/${data.shareToken}`
        :"")
      if(!url)throw new Error("The server did not return a share link")
      setShareInfo({title:docTitleRef.current,url})
    }catch(error){
      showToast(`Share failed: ${error.message}`,"error")
    }finally{
      setShareLoading(false)
    }
  }

  async function stopSharing(){
    if(!docIdRef.current)return
    try{
      const response=await authFetch(`/documents/${docIdRef.current}/share`,{
        method:"PATCH",body:JSON.stringify({isPublic:false}),
      })
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.error||"Could not stop sharing")
      setShareInfo(null)
      showToast("Public sharing stopped")
    }catch(error){
      showToast(`Could not stop sharing: ${error.message}`,"error")
    }
  }

  function openDoc(fullDoc){
    setShowOpen(false)
    setDocId(fullDoc.id||fullDoc._id); docIdRef.current=fullDoc.id||fullDoc._id
    setDocTitle(fullDoc.title); docTitleRef.current=fullDoc.title
    let storedHTML=fullDoc.html||""
    let embeddedSettings={}
    const settingsMatch=storedHTML.match(/<!-- KASHUR_SETTINGS:([^]*?) -->/)
    if(settingsMatch){
      try{embeddedSettings=JSON.parse(decodeURIComponent(settingsMatch[1]))}catch{}
      storedHTML=storedHTML.replace(settingsMatch[0],"")
    }
    const loadedComments=Array.isArray(fullDoc.comments)
      ?fullDoc.comments
      :Array.isArray(embeddedSettings.comments)?embeddedSettings.comments:[]
    const loadedChanges=Array.isArray(fullDoc.changes)
      ?fullDoc.changes
      :Array.isArray(embeddedSettings.changes)?embeddedSettings.changes:[]
    const loadedTracking=Boolean(fullDoc.trackChanges??embeddedSettings.trackChanges)
    setComments(loadedComments)
    setChanges(loadedChanges)
    setTrackChanges(loadedTracking)
    setShowComments(false)
    setActiveCommentId(null)
    const parts=storedHTML.split("\n<!-- PAGE_BREAK -->\n").filter(p=>p.trim())
    const count=Math.max(1,parts.length)
    setPageCount(count)
    // Wait for React to render the pages, then populate
    setTimeout(()=>{
      parts.forEach((html,i)=>{
        if(pagesRef.current[i]) pagesRef.current[i].innerHTML=html
      })
      // Clear any extra pages
      for(let i=parts.length;i<pagesRef.current.length;i++){
        if(pagesRef.current[i]) pagesRef.current[i].innerHTML=""
      }
      if(!loadedChanges.length)setChanges(collectTrackedChangesFromDocument())
      applyTrackedInsertAppearance(loadedTracking)
      initAllObjects()
      updateStats()
      // Re-run spill check after load
      setTimeout(spillCheck, 200)
      resetHistory()
    }, 120)
    dirtyRef.current=false
  }

  async function handleFileAction(label){
    setFileOpen(false)
    if(label==="New")newDoc()
    else if(label==="Open")requestDocumentTransition(()=>setShowOpen(true),"Open Another Document")
    else if(label==="Rename")handleRename()
    else if(label==="Share")openShareDialog()
    else if(label==="Save")saveNow()
    else if(label==="Save As")promptSaveAs()
    else if(label==="Print"){spillCheck();doPrintPopup(pagesRef,fontFamily,orientation,headerText,footerText,pageNumber,{setting:pageBorderSetting,style:pageBorderStyle,width:pageBorderWidth,color:pageBorderColor,sides:pageBorderSides},fontSize,lineSpacing,{headerAlign,footerAlign,pageNumberPosition,pageNumberFormat,pageNumberStart},DOCUMENT_THEMES[theme],pageColor,watermark)}
    else if(label==="Export DOCX")exportDoc("docx")
    else if(label==="Export PDF")exportDoc("pdf")
    else if(label==="Export TXT")exportDoc("txt")
    else if(label==="Properties"){
      const stats=calculateDocumentTextStats(
        pagesRef.current.filter(Boolean).map(extractEditorPageText),pageCount)
      const safeTitle=String(docTitleRef.current||"Document").replace(/[&<>"]/g,char=>({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;",
      }[char]))
      showModal({type:"info",title:"Document Properties",message:
        `<b>Title:</b> ${safeTitle}<br/>
        <b>Status:</b> ${dirtyRef.current?"Unsaved changes":docIdRef.current?"Saved":"Not saved yet"}<br/>
        <b>Pages:</b> ${stats.pages}<br/>
        <b>Words:</b> ${stats.words}<br/>
        <b>Characters (no spaces):</b> ${stats.charactersWithoutSpaces}<br/>
        <b>Characters (with spaces):</b> ${stats.charactersWithSpaces}<br/>
        <b>Paragraphs:</b> ${stats.paragraphs}<br/>
        <b>Orientation:</b> ${orientation==="landscape"?"Landscape":"Portrait"}`,
        onConfirm:closeModal})
    }
    else if(label==="Account Info")showAccountInfo()
    else if(label==="Close")requestDocumentTransition(
      ()=>onBackToDashboard?onBackToDashboard():resetToNewDocument(),
      "Close Document")
  }

  // INSERT HELPERS
  function insertTable(rows,cols,hdr,bdr){
    const id=`table_${Date.now()}`
    const b=bdr?"1px solid #bbb":"none";let html=`<table id="${id}" data-word-table="true" style="border-collapse:collapse;width:100%;direction:rtl;margin:10px 0;table-layout:fixed;">`
    for(let r=0;r<rows;r++){html+="<tr>";for(let c=0;c<cols;c++){const isH=r===0&&hdr;html+=`<${isH?"th":"td"} style="border:${b};padding:6px 8px;${isH?"background:var(--theme-accent1);color:#fff;font-weight:bold;":""}">&nbsp;</${isH?"th":"td"}>`;} html+="</tr>";}
    html+=`</table><p data-after-table="${id}"><br></p>`;exec("insertHTML",html)
    requestAnimationFrame(()=>{
      const table=document.getElementById(id),cell=table?.querySelector("th,td")
      if(!table||!cell)return
      setActiveTable(table);activeTableCellRef.current=cell
      const range=document.createRange();range.selectNodeContents(cell);range.collapse(true)
      const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
      activePgRef.current=pagesRef.current.find(page=>page?.contains(table))||activePgRef.current
      activePgRef.current?.focus({preventScroll:true});selection?.removeAllRanges();selection?.addRange(range)
      savedRangeRef.current=range.cloneRange()
    })
  }
  // ── Table editing operations ──────────────────────────────────────────────
  function getTableFromSelection(){
    const sel=window.getSelection(); if(!sel||!sel.anchorNode) return null
    let n=sel.anchorNode
    while(n&&n.tagName!=="TABLE") n=n.parentElement
    return n||null
  }
  function tableAddRow(table,before=false){
    if(!table) return
    const rows=table.querySelectorAll("tr"),last=rows[before?0:rows.length-1]; if(!last) return
    saveHistory()
    const newRow=document.createElement("tr")
    Array.from(last.cells).forEach(()=>{
      const td=document.createElement("td")
      td.style.cssText=last.cells[0].style.cssText||"border:1px solid #bbb;padding:6px 8px;"
      td.innerHTML="&nbsp;"; newRow.appendChild(td)
    })
    before?last.parentNode.insertBefore(newRow,last):last.parentNode.insertBefore(newRow,last.nextSibling)
    dirtyRef.current=true
  }
  function tableAddCol(table){
    if(!table) return
    saveHistory()
    table.querySelectorAll("tr").forEach(row=>{
      const td=row.cells[0]?document.createElement(row.cells[0].tagName):document.createElement("td")
      td.style.cssText=row.cells[0]?.style?.cssText||"border:1px solid #bbb;padding:6px 8px;"
      td.innerHTML="&nbsp;"; row.appendChild(td)
    })
    dirtyRef.current=true
  }
  function tableInsertRowRelative(table,before=false){
    const cell=activeTableCellRef.current
    const row=cell&&table?.contains(cell)?cell.parentElement:null
    if(!row)return
    saveHistory()
    const newRow=document.createElement("tr")
    Array.from(row.cells).forEach(source=>{
      const next=document.createElement("td")
      next.style.cssText=source.style.cssText||"border:1px solid #bbb;padding:6px 8px;"
      next.innerHTML="&nbsp;";newRow.appendChild(next)
    })
    row.parentNode.insertBefore(newRow,before?row:row.nextSibling)
    dirtyRef.current=true;placeCaretInCell(newRow.cells[0])
    requestAnimationFrame(()=>spillCheck())
  }
  function tableInsertColumnRelative(table,before=false){
    const cell=activeTableCellRef.current
    if(!cell||!table?.contains(cell))return
    const index=Array.from(cell.parentElement.cells).indexOf(cell)+(before?0:1)
    saveHistory()
    Array.from(table.rows).forEach(row=>{
      const source=row.cells[Math.min(index,row.cells.length-1)]||row.cells[0]
      const next=document.createElement(source?.tagName||"td")
      next.style.cssText=source?.style.cssText||"border:1px solid #bbb;padding:6px 8px;"
      next.innerHTML="&nbsp;";row.insertBefore(next,row.cells[index]||null)
    })
    dirtyRef.current=true;placeCaretInCell(cell.parentElement.cells[index])
  }
  function tableDelRow(table){
    if(!table) return
    const sel=window.getSelection(); if(!sel) return
    let n=sel.anchorNode; while(n&&n.tagName!=="TR") n=n.parentElement
    if((!n||!table.contains(n))&&activeTableCellRef.current&&table.contains(activeTableCellRef.current))n=activeTableCellRef.current.parentElement
    if(n&&n.parentNode&&table.querySelectorAll("tr").length>1){ saveHistory(); n.remove(); dirtyRef.current=true }
  }
  function tableDelCol(table){
    if(!table) return
    const sel=window.getSelection(); if(!sel) return
    let n=sel.anchorNode; while(n&&!["TD","TH"].includes(n.tagName)) n=n.parentElement
    if((!n||!table.contains(n))&&activeTableCellRef.current&&table.contains(activeTableCellRef.current))n=activeTableCellRef.current
    if(!n) return
    const idx=Array.from(n.parentNode.cells).indexOf(n)
    if(idx<0) return
    const rows=table.querySelectorAll("tr")
    if(rows[0].cells.length<=1) return
    saveHistory()
    rows.forEach(row=>{ if(row.cells[idx]) row.deleteCell(idx) })
    dirtyRef.current=true
  }
  function tableDeleteCell(table){
    const cell=activeTableCellRef.current
    if(!cell||!table?.contains(cell))return
    saveHistory()
    const row=cell.parentElement
    const next=cell.nextElementSibling||cell.previousElementSibling
    cell.remove()
    if(!row.cells.length&&table.rows.length>1)row.remove()
    dirtyRef.current=true
    if(next?.isConnected)placeCaretInCell(next)
  }
  function tableMergeCells(table){
    const sel=window.getSelection(); if(!sel||sel.rangeCount===0) return
    // Get selected cells
    const cells=[]
    table.querySelectorAll("td,th").forEach(cell=>{
      const r=document.createRange(); r.selectNode(cell)
      if(sel.containsNode(cell,true)) cells.push(cell)
    })
    if(cells.length<2){showToast("Select multiple cells to merge","error");return}
    saveHistory()
    const first=cells[0]
    const combined=cells.map(c=>c.innerHTML).join(" ")
    first.innerHTML=combined; first.colSpan=cells.length
    cells.slice(1).forEach(c=>c.remove())
    dirtyRef.current=true
  }
  function tableSplitCell(table){
    const cell=activeTableCellRef.current
    if(!cell||!table?.contains(cell))return
    saveHistory()
    const span=Math.max(1,parseInt(cell.colSpan)||1)
    cell.colSpan=1
    const count=span>1?span-1:1
    let after=cell
    for(let index=0;index<count;index++){
      const next=document.createElement(cell.tagName)
      next.style.cssText=cell.style.cssText;next.innerHTML="&nbsp;"
      after.parentNode.insertBefore(next,after.nextSibling);after=next
    }
    dirtyRef.current=true;placeCaretInCell(cell)
  }
  function tableSplitTable(table){
    const cell=activeTableCellRef.current
    const row=cell&&table?.contains(cell)?cell.parentElement:null
    if(!row||row===table.rows[0]){showToast("Place the cursor below the first row to split the table","error");return}
    saveHistory()
    const second=table.cloneNode(false)
    second.removeAttribute("id");second.id=`table_${Date.now()}`
    const body=document.createElement("tbody");second.appendChild(body)
    let moving=row
    while(moving){const next=moving.nextElementSibling;body.appendChild(moving);moving=next}
    const gap=document.createElement("p");gap.innerHTML="<br>"
    table.parentNode.insertBefore(gap,table.nextSibling)
    gap.parentNode.insertBefore(second,gap.nextSibling)
    dirtyRef.current=true;moveCaretOutsideTable(table,true)
    requestAnimationFrame(()=>spillCheck())
  }
  function tableDelete(table){
    if(!table||!table.isConnected)return
    saveHistory()
    const page=pagesRef.current.find(pg=>pg&&pg.contains(table))
    const after=table.nextElementSibling?.matches("p,div")?table.nextElementSibling:null
    table.remove()
    setActiveTable(null)
    dirtyRef.current=true
    if(page){
      const target=after&&page.contains(after)?after:null
      const range=document.createRange()
      if(target){range.selectNodeContents(target);range.collapse(true)}
      else{range.selectNodeContents(page);range.collapse(false)}
      page.focus({preventScroll:true})
      const selection=window.getSelection()
      selection?.removeAllRanges();selection?.addRange(range)
      savedRangeRef.current=range.cloneRange();activePgRef.current=page
    }
    updateStats()
    requestAnimationFrame(()=>spillCheck())
    showToast("Table deleted ✓")
  }
  function tableSetBorder(table,style){
    if(!table) return
    saveHistory()
    table.querySelectorAll("td,th").forEach(c=>{c.style.border=style})
    dirtyRef.current=true
    activeTableCellRef.current?.focus?.({preventScroll:true})
  }
  function tableSetBg(table,color){
    if(!table) return
    const sel=window.getSelection(); let n=sel?.anchorNode
    while(n&&!["TD","TH"].includes(n.tagName)) n=n?.parentElement
    const cell=n&&table.contains(n)?n:activeTableCellRef.current
    if(!cell||!table.contains(cell))return
    saveHistory()
    cell.style.background=color
    dirtyRef.current=true
  }
  function tableApplyStyle(table,style){
    if(!table)return
    saveHistory();table.dataset.tableStyle=style.id
    table.dataset.styleHead=style.head;table.dataset.styleBand=style.band
    table.dataset.styleText=style.text;table.dataset.styleBorder=style.border
    const headerEnabled=table.dataset.headerRow!=="false"
    const bandedEnabled=table.dataset.bandedRows!=="false"
    const firstEnabled=table.dataset.firstColumn==="true"
    const lastEnabled=table.dataset.lastColumn==="true"
    Array.from(table.rows).forEach((row,rowIndex)=>{
      Array.from(row.cells).forEach((cell,colIndex)=>{
        const emphasized=(firstEnabled&&colIndex===0)||(lastEnabled&&colIndex===row.cells.length-1)
        cell.style.border=`1px solid ${style.border}`
        cell.style.background=headerEnabled&&rowIndex===0?style.head:(bandedEnabled&&rowIndex%2===1?style.band:"#fff")
        cell.style.color=headerEnabled&&rowIndex===0?style.text:"#111"
        cell.style.fontWeight=headerEnabled&&rowIndex===0||emphasized?"700":"400"
        cell.style.padding="6px 8px"
      })
    })
    dirtyRef.current=true
  }
  function tableToggleOption(table,key,enabled){
    if(!table)return
    const attr={header:"headerRow",banded:"bandedRows",first:"firstColumn",last:"lastColumn"}[key]
    table.dataset[attr]=String(enabled)
    tableApplyStyle(table,{
      id:table.dataset.tableStyle||"plain",
      head:table.dataset.styleHead||"#ffffff",band:table.dataset.styleBand||"#ffffff",
      text:table.dataset.styleText||"#111",border:table.dataset.styleBorder||"#b7b7b7",
    })
  }
  function tableBorderPart(table,part,value){
    if(!table)return
    if(part==="color")table.dataset.borderColor=value
    if(part==="width")table.dataset.borderWidth=value
    if(part==="style")table.dataset.borderStyle=value
    const color=table.dataset.borderColor||"#b7b7b7"
    const width=table.dataset.borderWidth||"1"
    const style=table.dataset.borderStyle||"solid"
    tableSetBorder(table,style==="none"?"none":`${width}px ${style} ${color}`)
  }

  function placeCaretInCell(cell,atEnd=false){
    if(!cell)return
    activeTableCellRef.current=cell
    const page=pagesRef.current.find(pg=>pg&&pg.contains(cell))
    const range=document.createRange();range.selectNodeContents(cell);range.collapse(!atEnd)
    page?.focus({preventScroll:true})
    const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
    savedRangeRef.current=range.cloneRange();if(page)activePgRef.current=page
  }

  function handleTableEnter(cell){
    const selection=window.getSelection()
    if(!selection?.rangeCount)return false
    const range=selection.getRangeAt(0)
    if(!cell.contains(range.startContainer))return false
    saveHistory();range.deleteContents()
    let block=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement
    while(block&&block!==cell&&block.parentElement!==cell)block=block.parentElement
    const isParagraph=block&&block!==cell&&block.matches?.("p,div")
    const newLine=document.createElement(isParagraph?block.tagName:"div")
    const tail=document.createRange()
    if(isParagraph){
      tail.setStart(range.startContainer,range.startOffset)
      tail.setEnd(block,block.childNodes.length)
      newLine.appendChild(tail.extractContents())
      block.parentNode.insertBefore(newLine,block.nextSibling)
    }else{
      tail.setStart(range.startContainer,range.startOffset)
      tail.setEnd(cell,cell.childNodes.length)
      newLine.appendChild(tail.extractContents())
      cell.appendChild(newLine)
    }
    if(!newLine.childNodes.length)newLine.innerHTML="\u200B<br>"
    const page=pagesRef.current.find(pg=>pg&&pg.contains(cell))
    page?.focus({preventScroll:true})
    const firstText=document.createTreeWalker(newLine,NodeFilter.SHOW_TEXT).nextNode()
    if(firstText)range.setStart(firstText,firstText.textContent==="\u200B"?1:0)
    else{range.selectNodeContents(newLine);range.collapse(true)}
    range.collapse(true)
    selection.removeAllRanges();selection.addRange(range)
    savedRangeRef.current=range.cloneRange();activeTableCellRef.current=cell
    if(page)activePgRef.current=page
    dirtyRef.current=true
    return true
  }

  function handleTableTab(table,cell,backward=false){
    const cells=Array.from(table.querySelectorAll("th,td"))
    let index=cells.indexOf(cell)
    if(index<0)return false
    if(!backward&&index===cells.length-1){
      saveHistory()
      const lastRow=table.rows[table.rows.length-1]
      const newRow=lastRow.cloneNode(false)
      Array.from(lastRow.cells).forEach(source=>{
        const next=document.createElement("td")
        next.style.cssText=source.style.cssText||"border:1px solid #bbb;padding:6px 8px;"
        next.innerHTML="&nbsp;";newRow.appendChild(next)
      })
      lastRow.parentNode.appendChild(newRow)
      dirtyRef.current=true
      placeCaretInCell(newRow.cells[0])
      return true
    }
    const target=cells[index+(backward?-1:1)]
    if(target){placeCaretInCell(target);return true}
    return false
  }

  function moveCaretOutsideTable(table,after=true){
    const page=pagesRef.current.find(pg=>pg&&pg.contains(table));if(!page)return false
    let paragraph=after?table.nextElementSibling:table.previousElementSibling
    if(!paragraph||paragraph.matches("table")){
      paragraph=document.createElement("p");paragraph.innerHTML="<br>"
      after?table.parentNode.insertBefore(paragraph,table.nextSibling):table.parentNode.insertBefore(paragraph,table)
    }
    const range=document.createRange();range.selectNodeContents(paragraph);range.collapse(after?true:false)
    page.focus({preventScroll:true})
    const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
    savedRangeRef.current=range.cloneRange();activePgRef.current=page;setActiveTable(null)
    return true
  }

  // Detect click inside table to show toolbar
  useEffect(()=>{
    function onPageClick(e){
      if(e.target.closest?.("[data-table-ribbon='true'],[data-table-context-tab='true']"))return
      let n=e.target; while(n&&n.tagName!=="TABLE") n=n.parentElement
      const cell=e.target.closest?.("td,th")
      if(cell&&n?.contains(cell))activeTableCellRef.current=cell
      setActiveTable(n||null)
      if(n)setActiveTab("Table Design")
    }
    document.addEventListener("click",onPageClick)
    return()=>document.removeEventListener("click",onPageClick)
  },[])
  useEffect(()=>{
    if(!activeTable&&["Table Design","Table Layout"].includes(activeTab))setActiveTab("Home")
  },[activeTable,activeTab])

  function finishObjectInsert(id){
    const activate=()=>{
      const object=document.getElementById(id);if(!object)return
      const page=pagesRef.current.find(p=>p&&p.contains(object));if(!page)return
      initShapeInteraction(id)
      const caret=object.nextElementSibling?.matches(`[data-object-caret="${id}"]`)
        ?object.nextElementSibling:null
      const range=document.createRange()
      if(caret){range.selectNodeContents(caret);range.collapse(false)}
      else{range.setStartAfter(object);range.collapse(true)}
      page.focus()
      const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
      savedRangeRef.current=range.cloneRange();activePgRef.current=page
    }
    if(document.getElementById(id))activate();else requestAnimationFrame(activate)
  }
  function insertImage(src,width,align){
    const id="img_"+Date.now()
    const alignStyle={left:"margin-right:auto;",right:"margin-left:auto;",center:"margin:8px auto;"}[align]||""
    const html=`<span id="${id}" data-shape="image" contenteditable="false"
      style="display:inline-block;position:relative;width:${width}px;margin:8px;cursor:move;user-select:none;vertical-align:middle;${alignStyle}">
      <img src="${src}" style="width:100%;height:auto;display:block;border-radius:2px;pointer-events:none;"/>
      <span class="shape-sel-indicator" style="display:none;position:absolute;inset:-3px;border:2px dashed ${WORD_BLUE};border-radius:3px;pointer-events:none;z-index:10;"></span>
    </span>`
    exec("insertHTML",html+`<span data-object-caret="${id}">\u200B</span>`)
    finishObjectInsert(id)
  }
  function insertStyledImage(src,width,align,styleString){
    const id="img_"+Date.now()
    const alignStyle={left:"margin-right:auto;",right:"margin-left:auto;",center:"display:block;margin:8px auto;"}[align]||""
    const html=`<span id="${id}" data-shape="image" contenteditable="false"
      style="display:inline-block;position:relative;width:${width}px;margin:8px;cursor:move;user-select:none;vertical-align:middle;${alignStyle}">
      <img src="${src}" style="width:100%;height:auto;display:block;max-width:100%;${styleString||""}"/>
      <span class="shape-sel-indicator" style="display:none;position:absolute;inset:-3px;border:2px dashed ${WORD_BLUE};border-radius:3px;pointer-events:none;z-index:10;"></span>
    </span>`
    exec("insertHTML",html+`<span data-object-caret="${id}">\u200B</span>`)
    finishObjectInsert(id)
  }
  function insertDate(){exec("insertText",new Date().toLocaleDateString("ur-PK",{year:"numeric",month:"long",day:"numeric"}))}
  function insertDateTime(){const now=new Date();exec("insertText",`${now.toLocaleDateString("ur-PK",{year:"numeric",month:"long",day:"numeric",weekday:"long"})} — ${now.toLocaleTimeString("ur-PK",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`)}
  function insertLink(){
    saveSelection()
    setLinkSelectedText(window.getSelection()?.toString()||"")
    setShowLink(true)
  }
  function applyLink(displayText,url){
    let address=url.trim()
    if(!/^(https?:|mailto:|tel:|#)/i.test(address))address=`https://${address}`
    const escape=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))
    const text=(displayText||address).trim()
    exec("insertHTML",`<a href="${escape(address)}" target="_blank" rel="noopener noreferrer"
      data-word-link="true" title="${escape(address)}"
      style="color:var(--theme-accent1);text-decoration:underline;cursor:pointer;">${escape(text)}</a>`)
    setShowLink(false);showToast("Link inserted ✓")
  }
  function insertList(type){
    if(!type)return
    restoreSelection()
    const selection=window.getSelection()
    const anchor=selection?.anchorNode?.nodeType===1
      ?selection.anchorNode
      :selection?.anchorNode?.parentElement
    const currentList=anchor?.closest?.("ul,ol")

    function applyListStyle(list){
      const pg=activePgRef.current||pagesRef.current[0];if(!pg)return
      if(!list||!pg.contains(list))return
      list.classList.add("word-list")
      list.style.direction=pg.style.direction||"rtl"
      list.style.textAlign=pg.style.textAlign||"right"
      list.style.listStylePosition="outside"
      list.style.paddingInlineStart="0"
      list.style.paddingInlineEnd="32px"
      list.style.marginBlock="0"
      const oldMultilevel=list.closest("[data-multilevel]")
      oldMultilevel?.removeAttribute("data-multilevel")
      list.removeAttribute("data-custom-marker")
      list.removeAttribute("data-urdu-list")
      if(type.ls==="custom"&&type.custom){
        // A real marker (not text inside the LI) means Enter continues the
        // bullet and an empty Enter exits the list exactly like Word.
        list.style.listStyleType=`"${type.custom}  "`
        list.setAttribute("data-custom-marker",type.custom)
      }else if(type.ls==="custom-urdu"){
        list.style.listStyleType="kashur-urdu-digits"
        list.setAttribute("data-urdu-list","1")
      }else{
        list.style.listStyleType=type.ls
      }
      dirtyRef.current=true
      savedRangeRef.current=window.getSelection()?.rangeCount
        ?window.getSelection().getRangeAt(0).cloneRange()
        :savedRangeRef.current
    }

    if(currentList&&currentList.tagName.toLowerCase()===type.tag){
      // Changing ● to ○ (or one number format to another) must style the
      // existing list directly. Calling insertUnorderedList/OrderedList here
      // would toggle the list off, which was why the second choice vanished.
      saveHistory()
      applyListStyle(currentList)
      return
    }

    exec(type.tag==="ul"?"insertUnorderedList":"insertOrderedList")
    setTimeout(()=>{
      const pg=activePgRef.current||pagesRef.current[0];if(!pg)return
      const liveSelection=window.getSelection()
      const liveAnchor=liveSelection?.anchorNode?.nodeType===1
        ?liveSelection.anchorNode
        :liveSelection?.anchorNode?.parentElement
      const newList=liveAnchor?.closest?.(type.tag)
        ||Array.from(pg.querySelectorAll(type.tag)).slice(-1)[0]
      applyListStyle(newList)
    },0)
  }

  function insertMultilevelList(type){
    if(!type)return
    restoreSelection()
    const selection=window.getSelection()
    const anchor=selection?.anchorNode?.nodeType===1
      ?selection.anchorNode
      :selection?.anchorNode?.parentElement
    const currentList=anchor?.closest?.("ul,ol")

    function applyMultilevelStyle(startList){
      const pg=activePgRef.current||pagesRef.current[0];if(!pg)return
      let list=startList
      if(!list||!pg.contains(list))return
      // Apply the definition to the outer list so every Tab-created nested
      // list inherits the selected Word-style hierarchy.
      while(list.parentElement?.closest?.("ul,ol")&&pg.contains(list.parentElement.closest("ul,ol"))){
        list=list.parentElement.closest("ul,ol")
      }
      list.classList.add("word-list","word-multilevel")
      list.setAttribute("data-multilevel",type.id)
      list.style.direction=pg.style.direction||"rtl"
      list.style.textAlign=pg.style.textAlign||"right"
      list.style.paddingInlineStart="0"
      list.style.paddingInlineEnd="32px"
      list.style.marginBlock="0"
      list.removeAttribute("data-custom-marker")
      list.removeAttribute("data-urdu-list")
      list.style.listStyleType=type.id==="mixed"?`"◆  "`:"none"
      dirtyRef.current=true
      savedRangeRef.current=window.getSelection()?.rangeCount
        ?window.getSelection().getRangeAt(0).cloneRange()
        :savedRangeRef.current
    }

    if(currentList&&currentList.tagName.toLowerCase()===type.tag){
      // Changing one multilevel definition to another must restyle the
      // existing hierarchy, not toggle it off.
      saveHistory()
      applyMultilevelStyle(currentList)
      return
    }

    exec(type.tag==="ul"?"insertUnorderedList":"insertOrderedList")
    setTimeout(()=>{
      const pg=activePgRef.current||pagesRef.current[0];if(!pg)return
      const liveSelection=window.getSelection()
      const liveAnchor=liveSelection?.anchorNode?.nodeType===1
        ?liveSelection.anchorNode
        :liveSelection?.anchorNode?.parentElement
      const newList=liveAnchor?.closest?.(type.tag)
        ||Array.from(pg.querySelectorAll(type.tag)).slice(-1)[0]
      applyMultilevelStyle(newList)
    },0)
  }

  function removeList(){
    restoreSelection()
    const selection=window.getSelection()
    const anchor=selection?.anchorNode?.nodeType===1
      ?selection.anchorNode
      :selection?.anchorNode?.parentElement
    const list=anchor?.closest?.("ul,ol")
    if(!list)return
    saveHistory()
    list.closest("[data-multilevel]")?.removeAttribute("data-multilevel")
    xCmd(list.tagName==="UL"?"insertUnorderedList":"insertOrderedList")
    dirtyRef.current=true
    updateStats()
  }

  function changeListLevel(item,promote,page){
    if(!item||!page)return false
    const list=item.parentElement
    if(!list||!["UL","OL"].includes(list.tagName))return false
    const selection=window.getSelection()
    const liveRange=selection?.rangeCount?selection.getRangeAt(0).cloneRange():null

    if(promote){
      const ownerItem=list.parentElement?.closest?.("li")
      if(!ownerItem)return false
      const outerList=ownerItem.parentElement
      outerList.insertBefore(item,ownerItem.nextSibling)
      if(!list.querySelector(":scope > li"))list.remove()
    }else{
      const previous=item.previousElementSibling
      if(!previous||previous.tagName!=="LI")return false
      let nested=Array.from(previous.children)
        .find(child=>child.tagName===list.tagName)
      if(!nested){
        nested=document.createElement(list.tagName.toLowerCase())
        nested.className="word-list"
        nested.style.direction=list.style.direction||getComputedStyle(list).direction
        nested.style.textAlign=list.style.textAlign||getComputedStyle(list).textAlign
        nested.style.listStylePosition="outside"
        nested.style.paddingInlineStart="0"
        nested.style.paddingInlineEnd="28px"
        nested.style.marginBlock="0"
        nested.style.marginInlineStart="36px"
        previous.appendChild(nested)
      }
      nested.appendChild(item)
    }

    page.focus({preventScroll:true})
    const itemOwnText=Array.from(item.childNodes)
      .filter(node=>!(node.nodeType===1&&["UL","OL"].includes(node.tagName)))
      .map(node=>node.textContent||"").join("").replace(/\u200B/g,"").trim()
    if(!itemOwnText){
      // Empty LI boundaries render inconsistently after DOM nesting. Give the
      // caret a real inline text node beside the marker.
      let caretNode=Array.from(item.childNodes)
        .find(node=>node.nodeType===3&&node.textContent.includes("\u200B"))
      if(!caretNode){
        caretNode=document.createTextNode("\u200B")
        item.insertBefore(caretNode,item.firstChild)
      }
      const range=document.createRange()
      range.setStart(caretNode,caretNode.textContent.length);range.collapse(true)
      selection.removeAllRanges();selection.addRange(range)
      savedRangeRef.current=range.cloneRange()
    }else if(liveRange&&liveRange.startContainer.isConnected){
      selection.removeAllRanges();selection.addRange(liveRange)
      savedRangeRef.current=liveRange.cloneRange()
    }else{
      const range=document.createRange()
      range.selectNodeContents(item);range.collapse(false)
      selection.removeAllRanges();selection.addRange(range)
      savedRangeRef.current=range.cloneRange()
    }
    activePgRef.current=page
    return true
  }

  function handleListEnter(item,page){
    if(!item||!page)return false
    const list=item.parentElement
    if(!list||!["UL","OL"].includes(list.tagName))return false
    const selection=window.getSelection()
    if(!selection||!selection.rangeCount)return false
    let range=selection.getRangeAt(0)
    if(!item.contains(range.commonAncestorContainer))return false

    const ownText=Array.from(item.childNodes)
      .filter(node=>!(node.nodeType===1&&["UL","OL"].includes(node.tagName)))
      .map(node=>node.textContent||"")
      .join("")
      .replace(/\u200B/g,"")
      .trim()

    if(!ownText){
      const ownerItem=list.parentElement?.closest?.("li")
      if(ownerItem){
        return changeListLevel(item,true,page)
      }
      const paragraph=document.createElement("p")
      paragraph.innerHTML="<br>"
      paragraph.style.direction=page.style.direction||"rtl"
      paragraph.style.textAlign=page.style.textAlign||"right"
      list.parentNode.insertBefore(paragraph,list.nextSibling)
      item.remove()
      if(!list.querySelector(":scope > li"))list.remove()
      range=document.createRange()
      range.selectNodeContents(paragraph);range.collapse(true)
      page.focus({preventScroll:true})
      selection.removeAllRanges();selection.addRange(range)
      savedRangeRef.current=range.cloneRange()
      activePgRef.current=page
      return true
    }

    if(!range.collapsed){
      range.deleteContents()
      range=selection.getRangeAt(0)
    }
    const tailRange=document.createRange()
    tailRange.setStart(range.startContainer,range.startOffset)
    tailRange.setEnd(item,item.childNodes.length)
    const tail=tailRange.extractContents()

    const nextItem=item.cloneNode(false)
    nextItem.removeAttribute("id")
    nextItem.appendChild(tail)
    const hasVisibleContent=(nextItem.textContent||"").replace(/\u200B/g,"").length
      ||nextItem.querySelector("img,table,ul,ol,[data-shape]")
    if(!hasVisibleContent){
      nextItem.innerHTML="<br>"
      nextItem.insertBefore(document.createTextNode("\u200B"),nextItem.firstChild)
    }
    if(!item.childNodes.length)item.innerHTML="<br>"
    list.insertBefore(nextItem,item.nextSibling)

    range=document.createRange()
    const firstText=document.createTreeWalker(nextItem,NodeFilter.SHOW_TEXT).nextNode()
    if(firstText)range.setStart(firstText,firstText.textContent==="\u200B"?1:0)
    else{range.selectNodeContents(nextItem);range.collapse(true)}
    range.collapse(true)
    page.focus({preventScroll:true})
    selection.removeAllRanges();selection.addRange(range)
    savedRangeRef.current=range.cloneRange()
    activePgRef.current=page
    pendingSpillCursorRef.current=getCursorPos()
    return true
  }

  function applyParagraphLineSpacing(value){
    restoreSelection()
    const selection=window.getSelection()
    if(!selection||!selection.rangeCount)return
    const range=selection.getRangeAt(0)
    const page=pagesRef.current.find(pg=>pg&&pg.contains(range.commonAncestorContainer))
    if(!page)return
    saveHistory()
    const anchor=selection.anchorNode?.nodeType===1
      ?selection.anchorNode
      :selection.anchorNode?.parentElement
    if(range.collapsed){
      const block=anchor?.closest?.("p,div,h1,h2,h3,h4,h5,h6,li,blockquote")
      if(block&&page.contains(block))block.style.lineHeight=value
    }else{
      page.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,blockquote").forEach(block=>{
        try{if(range.intersectsNode(block))block.style.lineHeight=value}catch{}
      })
    }
    dirtyRef.current=true
    savedRangeRef.current=selection.getRangeAt(0).cloneRange()
    requestAnimationFrame(()=>spillCheck())
  }

  function applyLayoutParagraphFormat(property,value,returnCaret=false){
    // Use the range captured before the number input received focus. Do not
    // call restoreSelection() here: that would focus the page and eject the
    // user from the input after typing only one digit.
    const liveSelection=window.getSelection()
    const liveRange=liveSelection?.rangeCount?liveSelection.getRangeAt(0):null
    const saved=savedRangeRef.current?.cloneRange()
    const range=saved&&pagesRef.current.some(page=>page?.contains(saved.commonAncestorContainer))
      ?saved
      :liveRange&&pagesRef.current.some(page=>page?.contains(liveRange.commonAncestorContainer))
        ?liveRange.cloneRange()
        :null
    if(!range)return
    const blockSelector="p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre"
    const ownerPageFor=node=>pagesRef.current.find(page=>page&&(page===node||page.contains(node)))
    const paragraphFor=(node,page)=>{
      let element=node?.nodeType===1?node:node?.parentElement
      while(element&&element!==page){
        if(element.matches?.(blockSelector)
          &&!element.hasAttribute("data-shape")
          &&element.getAttribute("contenteditable")!=="false")return element
        element=element.parentElement
      }
      return null
    }
    // Top-level text is legal inside contentEditable even though it is not a
    // real Word paragraph. Wrap it without changing its text or caret so all
    // paragraph commands have a stable block to format.
    const wrapDirectText=(textNode,page)=>{
      if(!textNode||textNode.nodeType!==3||textNode.parentNode!==page)return null
      const paragraph=document.createElement("p")
      page.insertBefore(paragraph,textNode)
      paragraph.appendChild(textNode)
      return paragraph
    }
    let blocks=[]
    if(range.collapsed){
      const ownerPage=ownerPageFor(range.startContainer)
      let block=paragraphFor(range.startContainer,ownerPage)
      if(!block&&ownerPage)block=wrapDirectText(range.startContainer,ownerPage)
      if(!block&&ownerPage&&range.startContainer===ownerPage){
        // A caret between two existing blocks belongs to the closest
        // paragraph at that insertion point. Only create a new empty
        // paragraph when there is no adjacent paragraph to receive it.
        const after=ownerPage.childNodes[range.startOffset]||null
        const before=range.startOffset>0?ownerPage.childNodes[range.startOffset-1]:null
        block=paragraphFor(after,ownerPage)||paragraphFor(before,ownerPage)
        if(!block){
          block=document.createElement("p");block.innerHTML="<br>"
          ownerPage.insertBefore(block,after)
          range.selectNodeContents(block);range.collapse(true)
          savedRangeRef.current=range.cloneRange()
        }
      }
      if(block&&ownerPage)blocks=[block]
    }else{
      // Start from the selected text nodes so nested spans and browser-created
      // direct text resolve to the paragraph the user actually selected.
      pagesRef.current.filter(Boolean).forEach(page=>{
        const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT)
        const selectedText=[]
        let textNode
        while((textNode=walker.nextNode())){
          try{if(range.intersectsNode(textNode))selectedText.push(textNode)}catch{}
        }
        selectedText.forEach(node=>{
          const paragraph=paragraphFor(node,page)||wrapDirectText(node,page)
          if(paragraph)blocks.push(paragraph)
        })
        // Empty selected paragraphs contain only BR and therefore have no text
        // node; include those through a direct intersection check.
        page.querySelectorAll(blockSelector).forEach(block=>{
          if((block.textContent||"").replace(/\u200B/g,"").length)return
          try{if(range.intersectsNode(block))blocks.push(block)}catch{}
        })
      })
    }
    blocks=[...new Set(blocks)]
    // Indentation moves a list marker and its text together. Paragraph
    // Before/After spacing, however, belongs to each LI just like Word and
    // must not add one large margin around the entire list.
    if(property==="left"||property==="right"){
      blocks=blocks.map(block=>block.tagName==="LI"&&block.parentElement?.matches("ul,ol")
        ?block.parentElement
        :block)
    }
    blocks=[...new Set(blocks)]
    blocks=blocks.filter(block=>!blocks.some(other=>other!==block&&block.contains(other)))
    if(!blocks.length)return
    const number=Math.max(0,Number(value)||0)
    saveHistory()
    blocks.forEach(block=>{
      if(property==="left"||property==="right"){
        const computed=getComputedStyle(block)
        const cmFromPx=px=>Math.round((parseFloat(px)||0)*2.54/96*100)/100
        const currentStart=block.hasAttribute("data-word-left")
          ?Number(block.getAttribute("data-word-left"))||0
          :cmFromPx(computed.marginInlineStart)
        const currentEnd=block.hasAttribute("data-word-right")
          ?Number(block.getAttribute("data-word-right"))||0
          :cmFromPx(computed.marginInlineEnd)
        const start=property==="left"?number:currentStart
        const end=property==="right"?number:currentEnd
        // Remove old physical declarations from previous builds. Logical
        // margins automatically resolve to left/right from the paragraph's
        // current direction and therefore move its text and caret together.
        block.style.removeProperty("margin-left")
        block.style.removeProperty("margin-right")
        block.style.removeProperty("margin-inline-start")
        block.style.removeProperty("margin-inline-end")
        block.style.setProperty("margin-inline-start",`${start}cm`)
        block.style.setProperty("margin-inline-end",`${end}cm`)
      }
      if(property==="before")block.style.marginTop=`${number}pt`
      if(property==="after")block.style.marginBottom=`${number}pt`
      block.setAttribute(`data-word-${property}`,String(number))
    })
    if(property==="left")setIndentLeft(number)
    if(property==="right")setIndentRight(number)
    if(property==="before")setSpaceBefore(number)
    if(property==="after")setSpaceAfter(number)
    dirtyRef.current=true
    savedRangeRef.current=range.cloneRange()
    requestAnimationFrame(()=>{
      spillCheck()
      if(returnCaret)requestAnimationFrame(()=>{
        restoreSelection()
        const selection=window.getSelection()
        if(selection?.rangeCount){
          savedRangeRef.current=selection.getRangeAt(0).cloneRange()
          activePgRef.current=ownerPageFor(selection.getRangeAt(0).commonAncestorContainer)
            ||activePgRef.current
        }
      })
    })
  }

  function applyParagraphIndent(increase){
    restoreSelection()
    const selection=window.getSelection()
    if(!selection||!selection.rangeCount)return
    const range=selection.getRangeAt(0)
    const page=pagesRef.current.find(pg=>pg&&pg.contains(range.commonAncestorContainer))
    if(!page)return
    const paragraphSelector="p,div,h1,h2,h3,h4,h5,h6,blockquote,pre"
    const elementFor=node=>node?.nodeType===1?node:node?.parentElement
    const paragraphFor=(node,ownerPage)=>{
      let element=elementFor(node)
      while(element&&element!==ownerPage){
        if(element.matches?.(paragraphSelector)
          &&!element.hasAttribute("data-shape")
          &&element.getAttribute("contenteditable")!=="false")return element
        element=element.parentElement
      }
      return null
    }
    const wrapDirectText=(node,ownerPage)=>{
      if(node?.nodeType!==3||node.parentNode!==ownerPage)return null
      const paragraph=document.createElement("p")
      ownerPage.insertBefore(paragraph,node)
      paragraph.appendChild(node)
      return paragraph
    }
    const anchorElement=elementFor(range.startContainer)
    const item=anchorElement?.closest?.("li")
    saveHistory()

    if(item&&page.contains(item)){
      if(!changeListLevel(item,!increase,page)){
        const list=item.parentElement
        const current=Number.parseInt(list.getAttribute("data-word-indent")||"32",10)||32
        const next=Math.max(12,Math.min(176,current+(increase?18:-18)))
        list.setAttribute("data-word-indent",String(next))
        if((list.style.direction||getComputedStyle(list).direction)==="rtl"){
          list.style.paddingInlineEnd=`${next}px`
        }else{
          list.style.paddingInlineStart=`${next}px`
        }
      }
    }else{
      let blocks=[]
      if(range.collapsed){
        let block=paragraphFor(range.startContainer,page)
          ||wrapDirectText(range.startContainer,page)
        if(!block&&range.startContainer===page){
          const after=page.childNodes[range.startOffset]||null
          const before=range.startOffset>0?page.childNodes[range.startOffset-1]:null
          block=paragraphFor(after,page)||paragraphFor(before,page)
          if(!block){
            block=document.createElement("p")
            block.innerHTML="<br>"
            page.insertBefore(block,after)
            range.selectNodeContents(block)
            range.collapse(true)
          }
        }
        if(block)blocks=[block]
      }else{
        const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT)
        const selectedText=[]
        let textNode
        while((textNode=walker.nextNode())){
          try{if(range.intersectsNode(textNode))selectedText.push(textNode)}catch{}
        }
        selectedText.forEach(node=>{
          const block=paragraphFor(node,page)||wrapDirectText(node,page)
          if(block)blocks.push(block)
        })
        page.querySelectorAll(paragraphSelector).forEach(block=>{
          if((block.textContent||"").replace(/\u200B/g,"").length)return
          try{if(range.intersectsNode(block))blocks.push(block)}catch{}
        })
      }
      blocks=[...new Set(blocks)]
      blocks=blocks.filter(block=>block!==page
        &&!blocks.some(other=>other!==block&&block.contains(other)))
      if(!blocks.length)return
      blocks.forEach(block=>{
        const level=Number.parseInt(block.getAttribute("data-word-indent-level")||"0",10)||0
        const next=Math.max(0,Math.min(9,level+(increase?1:-1)))
        block.setAttribute("data-word-indent-level",String(next))
        block.style.marginInlineStart=`${next*36}px`
      })
    }
    dirtyRef.current=true
    savedRangeRef.current=range.cloneRange()
    requestAnimationFrame(()=>{
      spillCheck()
      // Force a fresh range paint after the paragraph has moved. This keeps
      // the caret attached to the same character instead of leaving the old
      // caret drawing at the pre-indent screen position.
      requestAnimationFrame(()=>{
        const saved=savedRangeRef.current?.cloneRange()
        const ownerPage=saved&&pagesRef.current.find(pg=>pg&&pg.contains(saved.commonAncestorContainer))
        if(!saved||!ownerPage)return
        ownerPage.focus({preventScroll:true})
        const liveSelection=window.getSelection()
        if(!liveSelection)return
        liveSelection.removeAllRanges()
        liveSelection.addRange(saved)
        savedRangeRef.current=saved.cloneRange()
        activePgRef.current=ownerPage
      })
    })
  }

  function applyParagraphAlignment(alignment){
    restoreSelection()
    const selection=window.getSelection()
    if(!selection||!selection.rangeCount)return
    const anchor=selection.anchorNode?.nodeType===1
      ?selection.anchorNode
      :selection.anchorNode?.parentElement
    const list=anchor?.closest?.("ul,ol")
    if(!list){
      const range=selection.getRangeAt(0)
      const page=pagesRef.current.find(pg=>pg&&pg.contains(anchor))
      if(!page)return
      saveHistory()
      const command={left:"justifyLeft",center:"justifyCenter",right:"justifyRight",justify:"justifyFull"}[alignment]
      // contentEditable may contain browser-created DIV paragraphs or even a
      // direct text node after Enter/pagination. The native paragraph command
      // handles those cases and creates a proper block when one is required.
      if(command)document.execCommand(command,false,null)

      const liveSelection=window.getSelection()
      const liveRange=liveSelection?.rangeCount?liveSelection.getRangeAt(0):range
      const liveAnchor=liveSelection?.anchorNode?.nodeType===1
        ?liveSelection.anchorNode
        :liveSelection?.anchorNode?.parentElement
      const blockSelector="p,div,h1,h2,h3,h4,h5,h6,blockquote"
      const blocks=range.collapsed
        ?[liveAnchor?.closest?.(blockSelector)]
          .filter(block=>block&&block!==page&&page.contains(block)&&!block.hasAttribute("data-shape"))
        :Array.from(page.querySelectorAll(blockSelector))
          .filter(block=>!block.hasAttribute("data-shape")
            &&!block.closest('[contenteditable="false"]')
            &&(()=>{try{return liveRange.intersectsNode(block)}catch{return false}})())
      if(!blocks.length){
        const created=liveAnchor?.closest?.("p,div")
        if(created&&created!==page&&page.contains(created))blocks.push(created)
      }
      blocks.forEach(block=>{block.style.textAlign=alignment})
      dirtyRef.current=true
      if(liveSelection?.rangeCount)savedRangeRef.current=liveSelection.getRangeAt(0).cloneRange()
      requestAnimationFrame(()=>spillCheck())
      return
    }

    saveHistory()
    const page=pagesRef.current.find(pg=>pg&&pg.contains(list))
    const writingDirection=getComputedStyle(list).direction
    list.style.textAlign=alignment
    list.style.listStylePosition="outside"

    if(alignment==="left"){
      list.style.direction="ltr"
      list.style.width="calc(100% - 32px)"
      list.style.marginLeft="0"
      list.style.marginRight="auto"
      list.style.paddingInlineStart="32px"
      list.style.paddingInlineEnd="0"
    }else if(alignment==="right"){
      list.style.direction="rtl"
      list.style.width="calc(100% - 32px)"
      list.style.marginLeft="auto"
      list.style.marginRight="0"
      list.style.paddingInlineStart="0"
      list.style.paddingInlineEnd="32px"
    }else if(alignment==="center"){
      list.style.direction=writingDirection
      list.style.width="fit-content"
      list.style.maxWidth="calc(100% - 32px)"
      list.style.marginLeft="auto"
      list.style.marginRight="auto"
      list.style.paddingInlineStart=writingDirection==="ltr"?"32px":"0"
      list.style.paddingInlineEnd=writingDirection==="rtl"?"32px":"0"
    }else{
      list.style.direction=writingDirection
      list.style.width="100%"
      list.style.maxWidth="100%"
      list.style.marginLeft="0"
      list.style.marginRight="0"
      list.style.paddingInlineStart=writingDirection==="ltr"?"32px":"0"
      list.style.paddingInlineEnd=writingDirection==="rtl"?"32px":"0"
    }

    list.querySelectorAll("li").forEach(item=>{
      item.style.textAlign=alignment
      // Alignment moves the list paragraph, but Kashmiri/English character
      // order must retain the paragraph's original writing direction.
      item.style.direction=writingDirection
    })
    dirtyRef.current=true
    savedRangeRef.current=selection.getRangeAt(0).cloneRange()
    requestAnimationFrame(()=>spillCheck())
  }

  // ✅ NEW: SHAPES
  // ═══════════════════════════════════════════════════
  //  FULL SHAPE SYSTEM — MS Word-like
  // ═══════════════════════════════════════════════════
  const [contextMenu,setContextMenu]=useState(null)

  function getShapeSVG(type, fill="#dce6f5", stroke="#2b579a", sw=2){
    const f=fill,s=stroke,w=sw
    const shapes={
      rect:         {vb:"0 0 120 80",  el:`<rect x="4" y="4" width="112" height="72" rx="4" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      square:       {vb:"0 0 100 100", el:`<rect x="4" y="4" width="92" height="92" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      circle:       {vb:"0 0 100 100", el:`<ellipse cx="50" cy="50" rx="46" ry="46" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      oval:         {vb:"0 0 140 90",  el:`<ellipse cx="70" cy="45" rx="66" ry="41" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      triangle:     {vb:"0 0 120 110", el:`<polygon points="60,4 116,106 4,106" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      diamond:      {vb:"0 0 120 120", el:`<polygon points="60,4 116,60 60,116 4,60" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      pentagon:     {vb:"0 0 120 120", el:`<polygon points="60,4 116,44 94,114 26,114 4,44" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      hexagon:      {vb:"0 0 120 110", el:`<polygon points="30,4 90,4 118,55 90,106 30,106 2,55" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      roundedrect:  {vb:"0 0 140 85",  el:`<rect x="4" y="4" width="132" height="77" rx="18" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      parallelogram:{vb:"0 0 140 85",  el:`<polygon points="28,4 136,4 112,81 4,81" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      trapezoid:    {vb:"0 0 140 85",  el:`<polygon points="28,4 112,4 136,81 4,81" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      octagon:      {vb:"0 0 120 120", el:`<polygon points="36,4 84,4 116,36 116,84 84,116 36,116 4,84 4,36" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      heart:        {vb:"0 0 120 110", el:`<path d="M60 104 C48 90 8 66 8 34 C8 8 42 0 60 25 C78 0 112 8 112 34 C112 66 72 90 60 104Z" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      moon:         {vb:"0 0 110 120", el:`<path d="M84 8 C48 16 34 50 47 80 C57 103 81 112 102 103 C81 123 43 118 22 91 C-3 58 10 14 47 3 C60-1 73 1 84 8Z" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      line:         {vb:"0 0 160 20",  el:`<line x1="4" y1="10" x2="156" y2="10" stroke="${s}" stroke-width="${w}" stroke-linecap="round"/>`},
      arrow:        {vb:"0 0 160 50",  el:`<polygon points="0,18 120,18 120,6 156,25 120,44 120,32 0,32" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      doublearrow:  {vb:"0 0 160 50",  el:`<polygon points="4,25 28,6 28,18 132,18 132,6 156,25 132,44 132,32 28,32 28,44" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      leftarrow:    {vb:"0 0 160 60",  el:`<polygon points="4,30 45,5 45,19 156,19 156,41 45,41 45,55" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      uparrow:      {vb:"0 0 80 140",  el:`<polygon points="40,4 76,46 58,46 58,136 22,136 22,46 4,46" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      downarrow:    {vb:"0 0 80 140",  el:`<polygon points="22,4 58,4 58,94 76,94 40,136 4,94 22,94" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      quadarrow:    {vb:"0 0 120 120", el:`<polygon points="60,2 78,22 68,22 68,52 98,52 98,42 118,60 98,78 98,68 68,68 68,98 78,98 60,118 42,98 52,98 52,68 22,68 22,78 2,60 22,42 22,52 52,52 52,22 42,22" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      chevron:      {vb:"0 0 120 90",  el:`<polygon points="4,4 62,4 116,45 62,86 4,86 58,45" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      notchedarrow: {vb:"0 0 160 70",  el:`<polygon points="4,8 112,8 112,2 156,35 112,68 112,62 4,62 25,35" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      curved:       {vb:"0 0 160 60",  el:`<path d="M4,50 Q80,4 156,50" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round"/>`},
      process:      {vb:"0 0 140 80",  el:`<rect x="4" y="4" width="132" height="72" rx="2" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      decision:     {vb:"0 0 140 100", el:`<polygon points="70,4 136,50 70,96 4,50" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      terminal:     {vb:"0 0 140 70",  el:`<rect x="4" y="4" width="132" height="62" rx="31" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      connector:    {vb:"0 0 80 80",   el:`<ellipse cx="40" cy="40" rx="36" ry="36" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      speechbubble: {vb:"0 0 140 110", el:`<path d="M8,4 Q4,4 4,8 L4,76 Q4,82 8,82 L54,82 L70,106 L86,82 L132,82 Q136,82 136,76 L136,8 Q136,4 132,4 Z" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      thoughtbubble:{vb:"0 0 140 120", el:`<ellipse cx="70" cy="46" rx="62" ry="42" fill="${f}" stroke="${s}" stroke-width="${w}"/><circle cx="50" cy="96" r="10" fill="${f}" stroke="${s}" stroke-width="${w}"/><circle cx="36" cy="112" r="6" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      commentbox:   {vb:"0 0 140 90",  el:`<rect x="4" y="4" width="132" height="70" rx="4" fill="${f}" stroke="${s}" stroke-width="${w}"/><line x1="20" y1="22" x2="120" y2="22" stroke="${s}" stroke-width="1.5"/><line x1="20" y1="37" x2="120" y2="37" stroke="${s}" stroke-width="1.5"/><line x1="20" y1="52" x2="80" y2="52" stroke="${s}" stroke-width="1.5"/>`},
      star:         {vb:"0 0 120 120", el:`<polygon points="60,4 72,44 114,44 80,68 92,110 60,84 28,110 40,68 6,44 48,44" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      star6:        {vb:"0 0 120 120", el:`<polygon points="60,4 69,38 104,20 86,52 120,60 86,68 104,100 69,82 60,116 51,82 16,100 34,68 0,60 34,52 16,20 51,38" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      banner:       {vb:"0 0 160 80",  el:`<path d="M4,16 L156,16 L156,64 L80,48 L4,64 Z" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      ribbon:       {vb:"0 0 160 80",  el:`<path d="M20,4 L140,4 L156,40 L140,76 L20,76 L4,40 Z" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      cloud:        {vb:"0 0 160 100", el:`<path d="M30,80 Q4,80 4,58 Q4,36 24,34 Q20,10 46,8 Q62,0 78,16 Q88,4 106,10 Q126,6 136,24 Q158,24 158,48 Q158,72 136,74 Q134,82 112,80 Z" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      sun:          {vb:"0 0 120 120", el:`<circle cx="60" cy="60" r="30" fill="${f}" stroke="${s}" stroke-width="${w}"/><path d="M60 2V20M60 100V118M2 60H20M100 60H118M19 19L32 32M88 88L101 101M101 19L88 32M32 88L19 101" stroke="${s}" stroke-width="${w+2}" stroke-linecap="round"/>`},
      lightning:    {vb:"0 0 90 130",  el:`<polygon points="52,3 10,72 42,72 31,127 80,55 49,55" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      plaque:       {vb:"0 0 140 90",  el:`<path d="M4 24 Q24 24 24 4 H116 Q116 24 136 24 V66 Q116 66 116 86 H24 Q24 66 4 66Z" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
      wave:         {vb:"0 0 160 80",  el:`<path d="M4 42 Q38 5 78 40 T156 38 V68 Q120 35 80 66 T4 64Z" fill="${f}" stroke="${s}" stroke-width="${w}"/>`},
    }
    return shapes[type]||shapes.rect
  }

  function insertShape(type){
    const id="shape_"+Date.now()
    const {vb,el}=getShapeSVG(type)
    const isLine=["line","curved"].includes(type)
    const isWide=["arrow","doublearrow","leftarrow","chevron","notchedarrow","banner","ribbon","cloud","oval","roundedrect","parallelogram","trapezoid","plaque","wave"].includes(type)
    const w=isLine||isWide?160:120, h=isLine?24:isWide?80:100
    const html=`<span id="${id}" data-shape="${type}" data-fill="#dce6f5" data-stroke="#2b579a" data-sw="2" data-rot="0" contenteditable="false"
      style="display:inline-block;position:relative;width:${w}px;height:${h}px;margin:8px 4px;cursor:move;user-select:none;vertical-align:middle;transform-origin:center center;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" style="display:block;overflow:visible;">${el}</svg>
      <div class="shape-text" style="position:absolute;inset:12%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#1a1a1a;text-align:center;pointer-events:none;word-break:break-word;line-height:1.3;"></div>
      <span class="shape-sel-indicator" style="display:none;position:absolute;inset:-3px;border:2px dashed ${WORD_BLUE};border-radius:3px;pointer-events:none;z-index:10;"></span>
    </span>`
    exec("insertHTML",html+`<span data-object-caret="${id}">\u200B</span>`)
    finishObjectInsert(id)
  }

  // ── ADMIN PANEL ADDITION — insert an admin-managed custom SVG shape ──────
  function insertCustomShape(svgMarkup){
    const id="shape_"+Date.now()
    const html=`<span id="${id}" data-shape="custom" data-rot="0" contenteditable="false"
      style="display:inline-block;position:relative;width:100px;height:100px;margin:8px 4px;cursor:move;user-select:none;vertical-align:middle;transform-origin:center center;">
      <div style="width:100%;height:100%;display:block;pointer-events:none;">${svgMarkup}</div>
      <span class="shape-sel-indicator" style="display:none;position:absolute;inset:-3px;border:2px dashed ${WORD_BLUE};border-radius:3px;pointer-events:none;z-index:10;"></span>
    </span>`
    exec("insertHTML",html+`<span data-object-caret="${id}">\u200B</span>`)
    finishObjectInsert(id)
  }

  function insertTextBoxLineBreak(text,event){
    event.preventDefault();event.stopPropagation()
    const selection=window.getSelection()
    let range=selection?.rangeCount?selection.getRangeAt(0):null
    if(!range||!text.contains(range.startContainer)){
      range=document.createRange();range.selectNodeContents(text);range.collapse(false)
    }
    range.deleteContents()
    const lineBreak=document.createElement("br")
    const caretNode=document.createTextNode("\u200B")
    const fragment=document.createDocumentFragment()
    fragment.appendChild(lineBreak);fragment.appendChild(caretNode)
    range.insertNode(fragment)
    range.setStart(caretNode,1);range.collapse(true)
    selection?.removeAllRanges();selection?.addRange(range)
    savedRangeRef.current=range.cloneRange()
    activePgRef.current=pagesRef.current.find(page=>page?.contains(text))||activePgRef.current
    dirtyRef.current=true;updateStats()
    clearTimeout(historySaveTimer.current)
    historySaveTimer.current=setTimeout(()=>{
      historySaveTimer.current=null
      saveHistory()
    },600)
    setHistoryVersion(version=>version+1)
    requestAnimationFrame(()=>spillCheck())
  }

  function initShapeInteraction(id){
    const el=document.getElementById(id); if(!el||el._shapeInit)return; el._shapeInit=true
    if(el.dataset.shape==="textbox"){
      const text=el.querySelector(".shape-text")||el.querySelector(':scope > div[contenteditable="true"]')
      if(text){
        text.classList.add("shape-text");text.dataset.textPosition="inside"
        text.style.cursor="text";text.style.whiteSpace="pre-wrap";text.style.overflowWrap="anywhere"
        if(!text._textBoxInit){
          text._textBoxInit=true
          text.addEventListener("mousedown",event=>event.stopPropagation())
          text.addEventListener("click",event=>event.stopPropagation())
          text.addEventListener("keydown",event=>{
            if(event.key==="Enter"&&!event.ctrlKey&&!event.metaKey){
              insertTextBoxLineBreak(text,event)
              return
            }
            event.stopPropagation()
          })
          text.addEventListener("input",()=>{
            dirtyRef.current=true;updateStats()
            clearTimeout(historySaveTimer.current)
            historySaveTimer.current=setTimeout(()=>{
              historySaveTimer.current=null
              saveHistory()
            },600)
            setHistoryVersion(version=>version+1)
            requestAnimationFrame(()=>spillCheck())
          })
        }
      }
    }
    el.addEventListener("mousedown",e=>{
      if(e.button!==0||e.target.closest(".shape-handle")||e.target.closest('.shape-text[contenteditable="true"]'))return
      e.preventDefault();e.stopPropagation();selectShape(el)
      let page=pagesRef.current.find(p=>p&&p.contains(el));if(!page)return
      let pageRect=page.getBoundingClientRect(),objectRect=el.getBoundingClientRect()
      let scale=pageRect.width/page.offsetWidth||1
      const sx=e.clientX,sy=e.clientY,grabX=(sx-objectRect.left)/scale,grabY=(sy-objectRect.top)/scale
      let dragX=sx,dragY=sy,floating=el.style.position==="absolute"
      let startLeft=parseFloat(el.style.left)||0,startTop=parseFloat(el.style.top)||0
      function makeFloating(){
        if(floating)return
        startLeft=(objectRect.left-pageRect.left)/scale;startTop=(objectRect.top-pageRect.top)/scale
        el.style.position="absolute";el.style.left=startLeft+"px";el.style.top=startTop+"px";el.style.margin="0";el.style.zIndex="20";floating=true
      }
      function mv(ev){
        const targetPage=pagesRef.current.find(p=>{if(!p)return false;const r=p.getBoundingClientRect();return ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom})
        if(targetPage&&targetPage!==page){
          makeFloating();page=targetPage;page.appendChild(el);pageRect=page.getBoundingClientRect();scale=pageRect.width/page.offsetWidth||1
          startLeft=(ev.clientX-pageRect.left)/scale-grabX;startTop=(ev.clientY-pageRect.top)/scale-grabY;dragX=ev.clientX;dragY=ev.clientY
        }
        makeFloating()
        const maxLeft=Math.max(0,page.clientWidth-el.offsetWidth),maxTop=Math.max(0,page.clientHeight-el.offsetHeight)
        el.style.left=Math.max(0,Math.min(maxLeft,startLeft+(ev.clientX-dragX)/scale))+"px"
        el.style.top=Math.max(0,Math.min(maxTop,startTop+(ev.clientY-dragY)/scale))+"px"
      }
      function up(){window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);if(floating){dirtyRef.current=true;saveHistory()}}
      window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up)
    })
    el.addEventListener("dblclick",e=>{
      e.stopPropagation()
      if(el.hasAttribute("data-chart")){openExistingChartEditor(el);return}
      const td=el.querySelector(".shape-text"); if(!td)return
      td.style.pointerEvents="all"; td.contentEditable="true"
      td.style.outline="1px dashed rgba(43,87,154,.5)"; td.focus()
      const r=document.createRange(); r.selectNodeContents(td); r.collapse(false)
      const s=window.getSelection(); s.removeAllRanges(); s.addRange(r)
    })
    el.addEventListener("contextmenu",e=>{
      e.preventDefault(); e.stopPropagation(); selectShape(el)
      setContextMenu({x:e.clientX,y:e.clientY,el})
    })
  }

  // Saved document HTML does not retain browser event listeners. Reconnect
  // every existing object after loading, opening, undoing, or redoing a page.
  function initAllObjects(){
    let sequence=0
    pagesRef.current.filter(Boolean).forEach(page=>{
      page.querySelectorAll("[data-shape],[data-chart],.img-wrap").forEach(el=>{
        if(el.classList.contains("img-wrap")&&!el.dataset.shape){
          el.id=el.id||`img_${Date.now()}_${sequence++}`
          el.dataset.shape="image";el.contentEditable="false"
          el.style.display="inline-block";el.style.position="relative";el.style.cursor="move";el.style.userSelect="none"
          const img=el.querySelector("img");if(img)img.style.pointerEvents="none"
          if(!el.querySelector(".shape-sel-indicator")){
            const indicator=document.createElement("span");indicator.className="shape-sel-indicator"
            indicator.style.cssText=`display:none;position:absolute;inset:-3px;border:2px dashed ${WORD_BLUE};border-radius:3px;pointer-events:none;z-index:10;`
            el.appendChild(indicator)
          }
        }
        if(!el.id)el.id=`object_${Date.now()}_${sequence++}`
        initShapeInteraction(el.id)
      })
      // Older documents may contain a bare <img> rather than an image wrapper.
      page.querySelectorAll("img").forEach(img=>{
        if(img.closest("[data-shape],[data-chart],.img-wrap"))return
        const wrapper=document.createElement("span");wrapper.id=`img_${Date.now()}_${sequence++}`
        wrapper.dataset.shape="image";wrapper.contentEditable="false"
        wrapper.style.cssText="display:inline-block;position:relative;margin:8px;cursor:move;user-select:none;vertical-align:middle;"
        img.parentNode?.insertBefore(wrapper,img);wrapper.appendChild(img);img.style.pointerEvents="none"
        const indicator=document.createElement("span");indicator.className="shape-sel-indicator"
        indicator.style.cssText=`display:none;position:absolute;inset:-3px;border:2px dashed ${WORD_BLUE};border-radius:3px;pointer-events:none;z-index:10;`
        wrapper.appendChild(indicator);initShapeInteraction(wrapper.id)
      })
    })
  }

  function selectShape(el){
    document.querySelectorAll(".shape-text[contenteditable=\'true\']").forEach(td=>{td.contentEditable="false";td.style.pointerEvents="none";td.style.outline="none"})
    document.querySelectorAll("[data-shape],[data-chart]").forEach(s=>{s.querySelector(".shape-sel-indicator")&&(s.querySelector(".shape-sel-indicator").style.display="none");s.querySelectorAll(".shape-handle").forEach(h=>h.remove())})
    const ind=el.querySelector(".shape-sel-indicator"); if(ind)ind.style.display="block"
    setSelectedShape(el); addResizeHandles(el)
  }

  function addResizeHandles(el){
    el.querySelectorAll(".shape-handle").forEach(h=>h.remove())
    const handles=[
      {id:"nw",top:"-5px",left:"-5px",cur:"nw-resize"},
      {id:"n", top:"-5px",left:"calc(50% - 4px)",cur:"n-resize"},
      {id:"ne",top:"-5px",right:"-5px",cur:"ne-resize"},
      {id:"e", top:"calc(50% - 4px)",right:"-5px",cur:"e-resize"},
      {id:"se",bottom:"-5px",right:"-5px",cur:"se-resize"},
      {id:"s", bottom:"-5px",left:"calc(50% - 4px)",cur:"s-resize"},
      {id:"sw",bottom:"-5px",left:"-5px",cur:"sw-resize"},
      {id:"w", top:"calc(50% - 4px)",left:"-5px",cur:"w-resize"},
      {id:"rot",top:"-28px",left:"calc(50% - 7px)",cur:"grab",rotate:true},
    ]
    handles.forEach(pos=>{
      const h=document.createElement("span"); h.className="shape-handle"
      let css=`position:absolute;z-index:999;`
      if(pos.rotate) css+=`width:14px;height:14px;background:#fff;border:2px solid ${WORD_BLUE};border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center;`
      else css+=`width:9px;height:9px;background:#fff;border:2px solid ${WORD_BLUE};border-radius:2px;`
      if(pos.top)    css+=`top:${pos.top};`
      if(pos.bottom) css+=`bottom:${pos.bottom};`
      if(pos.left)   css+=`left:${pos.left};`
      if(pos.right)  css+=`right:${pos.right};`
      css+=`cursor:${pos.cur};`
      h.style.cssText=css
      if(pos.rotate) h.textContent="↻"
      h.addEventListener("mousedown",e=>{
        e.preventDefault(); e.stopPropagation()
        if(pos.rotate){
          const rc=el.getBoundingClientRect(),cx=rc.left+rc.width/2,cy=rc.top+rc.height/2
          function mv(e){const a=Math.round((Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI+90)/15)*15;el.style.transform=`rotate(${a}deg)`;el.dataset.rot=a}
          function up(){window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)}
          window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up); return
        }
        const sx=e.clientX,sy=e.clientY,ow=el.offsetWidth,oh=el.offsetHeight
        function mv(e){
          const dw=e.clientX-sx,dh=e.clientY-sy
          if(["e","se","ne"].includes(pos.id))el.style.width=Math.max(30,ow+dw)+"px"
          if(["w","sw","nw"].includes(pos.id))el.style.width=Math.max(30,ow-dw)+"px"
          if(["s","se","sw"].includes(pos.id))el.style.height=Math.max(20,oh+dh)+"px"
          if(["n","ne","nw"].includes(pos.id))el.style.height=Math.max(20,oh-dh)+"px"
        }
        function up(){window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)}
        window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up)
      })
      el.appendChild(h)
    })
  }

  useEffect(()=>{
    function deselect(e){
      if(!e.target.closest("[data-shape],[data-chart]")&&!e.target.closest("#shape-toolbar")&&!e.target.closest("#shape-ctx-menu")){
        document.querySelectorAll("[data-shape],[data-chart]").forEach(s=>{s.querySelector(".shape-sel-indicator")&&(s.querySelector(".shape-sel-indicator").style.display="none");s.querySelectorAll(".shape-handle").forEach(h=>h.remove())})
        setSelectedShape(null); setContextMenu(null)
      }
    }
    document.addEventListener("mousedown",deselect)
    return()=>document.removeEventListener("mousedown",deselect)
  },[])

  function rebuildShapeSVG(el,fill,stroke,sw){
    const type=el.dataset.shape; if(!type)return
    const f=fill||el.dataset.fill||"#dce6f5",s=stroke||el.dataset.stroke||"#2b579a",w=sw||parseInt(el.dataset.sw)||2
    el.dataset.fill=f; el.dataset.stroke=s; el.dataset.sw=w
    if(type==="image"){
      const image=el.querySelector("img")
      if(image){image.style.border=`${w}px solid ${s}`;image.style.boxSizing="border-box"}
      let tint=el.querySelector(":scope > .image-fill-overlay")
      if(!tint){
        tint=document.createElement("span")
        tint.className="image-fill-overlay"
        tint.style.cssText="position:absolute;inset:0;z-index:3;pointer-events:none;mix-blend-mode:multiply;opacity:.32;border-radius:inherit;"
        el.insertBefore(tint,el.querySelector(".shape-sel-indicator"))
      }
      tint.style.background=f
      tint.style.display=fill?"block":tint.style.display||"none"
      dirtyRef.current=true;refreshSelectedShape(value=>value+1)
      return
    }
    const {vb,el:svgEl}=getShapeSVG(type,f,s,w)
    const svg=el.querySelector("svg"); if(!svg)return
    svg.setAttribute("viewBox",vb); svg.innerHTML=svgEl
  }
  function applyObjectEffect(el,effect){
    if(!el)return
    const image=el.dataset.shape==="image"?el.querySelector("img"):el
    if(!image)return
    saveHistory()
    image.style.webkitBoxReflect=""
    const effects={
      none:"none",
      shadow:"drop-shadow(5px 5px 6px rgba(0,0,0,.45))",
      glow:"drop-shadow(0 0 7px rgba(43,87,154,.9)) drop-shadow(0 0 13px rgba(43,87,154,.5))",
      reflect:"none",
    }
    image.style.filter=effects[effect]||"none"
    if(effect==="reflect")image.style.webkitBoxReflect="below 5px linear-gradient(transparent 55%,rgba(0,0,0,.28))"
    el.dataset.pictureEffect=effect
    dirtyRef.current=true;refreshSelectedShape(current=>current+1)
  }
  function resizeSelectedObject(el,dimension,value){
    if(!el)return
    const pixels=Math.max(dimension==="width"?30:20,Math.min(1200,parseInt(value)||0))
    el.style[dimension]=`${pixels}px`
    if(el.dataset.shape==="image"){
      const image=el.querySelector("img")
      if(image){
        image.style.width="100%"
        image.style.height="100%"
        image.style.objectFit="cover"
        image.style.display="block"
      }
      el.style.overflow="hidden"
    }
    dirtyRef.current=true;refreshSelectedShape(current=>current+1)
    requestAnimationFrame(()=>spillCheck())
  }
  function editObjectText(el,position="bottom"){
    if(!el)return
    let text=el.querySelector(`.shape-text[data-text-position="${position}"]`)
    if(!text){
      text=document.createElement("div")
      text.className="shape-text"
      text.dataset.textPosition=position
      text.style.cssText="position:absolute;z-index:12;display:block;text-align:center;color:#fff;font-weight:600;font-size:16px;line-height:1.3;white-space:pre-wrap;overflow:auto;text-shadow:0 1px 3px rgba(0,0,0,.8);padding:9px 10px;box-sizing:border-box;word-break:break-word;background:transparent;min-height:38px;max-height:48%;width:100%;"
      el.appendChild(text)
    }
    text.dataset.textPosition=position
    text.style.inset="auto"
    text.style.display="block";text.style.background="transparent"
    text.style.minHeight="38px";text.style.maxHeight="48%"
    text.style.left="0";text.style.right="0";text.style.width="100%"
    if(position==="top"){
      text.style.top="0";text.style.bottom="auto";text.style.borderRadius="0 0 5px 5px"
    }else{
      text.style.top="auto";text.style.bottom="0";text.style.borderRadius="5px 5px 0 0"
    }
    text.style.pointerEvents="all";text.contentEditable="true";text.style.outline="1px dashed rgba(255,255,255,.85)"
    if(!text._wordEnterInit){
      text._wordEnterInit=true
      text.addEventListener("keydown",event=>{
        if(event.key==="Enter"&&!event.ctrlKey&&!event.metaKey){
          insertTextBoxLineBreak(text,event)
        }
      })
    }
    text.focus()
    const range=document.createRange();range.selectNodeContents(text);range.collapse(false)
    const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
    setContextMenu(null)
  }

  function deleteSelectedShape(){if(!selectedShape)return;selectedShape.remove();setSelectedShape(null);setContextMenu(null);dirtyRef.current=true;saveHistory()}

  useEffect(()=>{
    function deleteWithKeyboard(e){
      if(!selectedShape||!selectedShape.isConnected)return
      const tag=e.target?.tagName
      if(["INPUT","TEXTAREA","SELECT"].includes(tag)||e.target?.closest?.('.shape-text[contenteditable="true"]'))return
      if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();deleteSelectedShape()}
    }
    document.addEventListener("keydown",deleteWithKeyboard,true)
    return()=>document.removeEventListener("keydown",deleteWithKeyboard,true)
  },[selectedShape])

  function duplicateShape(el){
    const cl=el.cloneNode(true); cl.id="shape_"+Date.now(); cl._shapeInit=false
    cl.style.marginLeft=(parseInt(el.style.marginLeft||0)+24)+"px"
    cl.style.marginTop=(parseInt(el.style.marginTop||0)+24)+"px"
    el.parentNode?.insertBefore(cl,el.nextSibling)
    setTimeout(()=>initShapeInteraction(cl.id),30); setContextMenu(null)
  }



  function insertChart(type){
    const id="chart_"+Date.now()
    let svg=""
    if(type==="bar"){
      const bars=[["Jan","60","#2b579a"],["Feb","90","#e8a020"],["Mar","50","#27ae60"],["Apr","75","#c0392b"],["May","85","#8e44ad"]]
      svg=`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 300 180">
        <text x="150" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">Bar Chart</text>
        <line x1="15" y1="150" x2="285" y2="150" stroke="#ccc" stroke-width="1"/>
        ${bars.map(([l,h,c],i)=>`<rect x="${20+i*52}" y="${150-parseInt(h)}" width="36" height="${h}" fill="${c}" rx="3"/><text x="${38+i*52}" y="165" text-anchor="middle" font-size="9" fill="#555">${l}</text>`).join("")}
      </svg>`
    }else if(type==="pie"){
      svg=`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 220 200">
        <text x="110" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">Pie Chart</text>
        <circle cx="110" cy="110" r="70" fill="none" stroke="#2b579a" stroke-width="70" stroke-dasharray="110 110" stroke-dashoffset="0" style="transform:rotate(-90deg);transform-origin:110px 110px"/>
        <circle cx="110" cy="110" r="70" fill="none" stroke="#e8a020" stroke-width="70" stroke-dasharray="66 154" stroke-dashoffset="-110" style="transform:rotate(-90deg);transform-origin:110px 110px"/>
        <circle cx="110" cy="110" r="70" fill="none" stroke="#27ae60" stroke-width="70" stroke-dasharray="44 176" stroke-dashoffset="-176" style="transform:rotate(-90deg);transform-origin:110px 110px"/>
        <circle cx="110" cy="110" r="35" fill="#fafafa"/>
        <text x="110" y="114" text-anchor="middle" font-size="10" fill="#555">50%/30%/20%</text>
      </svg>`
    }else{
      const pts=[[20,120],[70,70],[120,90],[170,40],[220,60],[270,80]]
      svg=`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 300 160">
        <text x="150" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">Line Chart</text>
        <polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="#2b579a" stroke-width="2.5"/>
        ${pts.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4" fill="#2b579a" stroke="#fff" stroke-width="1.5"/>`).join("")}
        <line x1="15" y1="140" x2="285" y2="140" stroke="#ccc" stroke-width="1"/>
      </svg>`
    }
    const html=`<span id="${id}" data-shape="chart" contenteditable="false"
      style="display:inline-block;position:relative;width:300px;height:180px;margin:8px;cursor:move;user-select:none;vertical-align:middle;border:1px solid #e0e0e0;border-radius:6px;background:#fafafa;">
      ${svg}
      <span class="shape-sel-indicator" style="display:none;position:absolute;inset:-3px;border:2px solid #2b579a;border-radius:4px;pointer-events:none;"></span>
    </span>`
    exec("insertHTML",html+`<span data-object-caret="${id}">\u200B</span>`)
    finishObjectInsert(id)
  }

  // Word-like Header, Footer and Page Number galleries.
  function applyHeaderPreset(preset){
    setShowHeader(true);setHeaderStyle(preset?.id||"blank");setHeaderAlign(preset?.align||"center")
  }
  function applyFooterPreset(preset){
    setShowFooter(true);setFooterStyle(preset?.id||"blank");setFooterAlign(preset?.align||"left")
  }
  function applyPageNumberPreset(preset){
    setPageNumber(true)
    setPageNumberPosition(preset?.position||"bottom-right")
    setPageNumberFormat(preset?.format||"number")
  }
  function removeHeader(){setShowHeader(false)}
  function removeFooter(){setShowFooter(false)}
  function removePageNumber(){setPageNumber(false)}

  // ── FEATURE 1: Insert Chart from Chart Editor ────────────────────────────
  function insertLiveChart(imgDataUrl, meta) {
    const id = "chart_" + Date.now()
    const html = `<span id="${id}" data-chart="${encodeURIComponent(meta)}" contenteditable="false"
      style="display:inline-block;position:relative;width:380px;height:260px;margin:8px 4px;cursor:move;user-select:none;vertical-align:middle;">
      <img src="${imgDataUrl}" style="width:100%;height:100%;display:block;border-radius:6px;border:1px solid #e0e0e0;"/>
      <span class="shape-sel-indicator" style="display:none;position:absolute;inset:-3px;border:2px dashed ${WORD_BLUE};border-radius:4px;pointer-events:none;z-index:10;"></span>
    </span>`
    exec("insertHTML",html+`<span data-object-caret="${id}">\u200B</span>`)
    finishObjectInsert(id)
  }
  function openExistingChartEditor(chart){
    if(!chart)return
    try{
      const meta=JSON.parse(decodeURIComponent(chart.dataset.chart||"{}"))
      setChartEditorTarget({element:chart,meta})
      setShowChartEditor(true);setContextMenu(null)
    }catch{
      showToast("This chart has no editable data","error")
    }
  }
  function updateLiveChart(imgDataUrl,meta){
    const chart=chartEditorTarget?.element
    if(!chart?.isConnected)return
    saveHistory()
    const image=chart.querySelector("img")
    if(image)image.src=imgDataUrl
    chart.dataset.chart=encodeURIComponent(meta)
    dirtyRef.current=true;setChartEditorTarget(null)
    setSelectedShape(chart);requestAnimationFrame(()=>spillCheck())
  }

  // ── FEATURE 2: Table of Contents ─────────────────────────────────────────
  function insertTOC(html,updateExisting=false){
    if(!html)return
    if(updateExisting){
      const existing=pagesRef.current.filter(Boolean)
        .map(page=>page.querySelector('[data-word-toc="true"]')).find(Boolean)
      if(existing){
        saveHistory()
        const holder=document.createElement("div");holder.innerHTML=html
        const replacement=holder.firstElementChild
        if(replacement)existing.replaceWith(replacement)
        dirtyRef.current=true;updateStats()
        requestAnimationFrame(()=>spillCheck())
        showToast("Table of Contents updated ✓")
        return
      }
    }
    const afterId=`toc_after_${Date.now()}`
    exec("insertHTML",`${html}<p id="${afterId}" data-after-toc="true"><br></p>`)
    setTimeout(()=>{
      const paragraph=document.getElementById(afterId)
      const page=pagesRef.current.find(current=>current?.contains(paragraph))
      if(!paragraph||!page)return
      page.focus({preventScroll:true})
      const range=document.createRange();range.selectNodeContents(paragraph);range.collapse(true)
      const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
      savedRangeRef.current=range.cloneRange();activePgRef.current=page
      requestAnimationFrame(()=>spillCheck())
    },0)
    showToast("Table of Contents inserted ✓")
  }

  // ── FEATURE 3: Comments ───────────────────────────────────────────────────
  function addComment(){
    restoreSelection()
    const selection=window.getSelection()
    if(!selection?.rangeCount)return
    const liveRange=selection.getRangeAt(0)
    const startPage=pagesRef.current.find(page=>page?.contains(liveRange.startContainer))
    const endPage=pagesRef.current.find(page=>page?.contains(liveRange.endContainer))
    if(!startPage||!endPage){
      showToast("Place the cursor in the document first","error")
      return
    }
    if(startPage!==endPage){
      showToast("Select text within one page for a comment","error")
      return
    }
    const savedRange=liveRange.cloneRange()
    const selectedText=liveRange.toString().trim()
    showModal({
      type:"prompt",title:"New Comment",
      message:selectedText
        ?`Comment on: <b>${selectedText.slice(0,80).replace(/[<>&]/g,"")}${selectedText.length>80?"…":""}</b>`
        :"Add a comment at the current cursor position.",
      inputDefault:"",
      onConfirm:value=>{
        const commentText=String(value||"").trim()
        if(!commentText){
          closeModal()
          showToast("Type a comment before adding it","error")
          return
        }
        closeModal()
        saveHistory()
        const id=`${Date.now()}_${Math.random().toString(36).slice(2,7)}`
        const mark=document.createElement("mark")
        mark.id=`cmt_${id}`
        mark.dataset.commentId=id
        mark.dataset.commentResolved="false"
        mark.title=commentText
        mark.style.cssText="background:#fff2a8;border-bottom:2px solid #e8a020;border-radius:2px;cursor:pointer;"
        try{
          if(savedRange.collapsed){
            mark.dataset.commentAnchor="cursor"
            mark.contentEditable="false"
            mark.textContent="\u200B"
            mark.style.borderLeft="3px solid #e8a020"
            savedRange.insertNode(mark)
          }else{
            const fragment=savedRange.extractContents()
            mark.appendChild(fragment)
            savedRange.insertNode(mark)
          }
        }catch{
          showToast("Could not anchor the comment to that selection","error")
          return
        }
        const comment={
          id,text:commentText,selectedText,author:"You",
          time:Date.now(),resolved:false,
        }
        const nextComments=[...comments,comment]
        setComments(nextComments)
        setActiveCommentId(id)
        setShowComments(true)
        dirtyRef.current=true
        updateStats()
        setTimeout(()=>saveHistory({comments:nextComments}),0)
        showToast("Comment added")
      },
    })
  }

  function resolveComment(id){
    saveHistory()
    let resolved=false
    const nextComments=comments.map(comment=>{
      if(comment.id!==id)return comment
      resolved=!comment.resolved
      return {...comment,resolved}
    })
    setComments(nextComments)
    document.querySelectorAll(`[data-comment-id="${id}"]`).forEach(mark=>{
      mark.dataset.commentResolved=String(resolved)
      mark.style.background=resolved?"#eeeeee":"#fff2a8"
      mark.style.borderBottomColor=resolved?"#999":"#e8a020"
    })
    dirtyRef.current=true
    setTimeout(()=>saveHistory({comments:nextComments}),0)
    showToast(resolved?"Comment resolved":"Comment reopened")
  }

  function deleteComment(id){
    saveHistory()
    document.querySelectorAll(`[data-comment-id="${id}"]`).forEach(mark=>{
      if(mark.dataset.commentAnchor==="cursor")mark.remove()
      else mark.replaceWith(...Array.from(mark.childNodes))
    })
    const nextComments=comments.filter(comment=>comment.id!==id)
    setComments(nextComments)
    if(activeCommentId===id)setActiveCommentId(null)
    dirtyRef.current=true
    updateStats()
    setTimeout(()=>saveHistory({comments:nextComments}),0)
    showToast("Comment deleted")
  }

  function scheduleTrackedHistory(overrides={}){
    clearTimeout(historySaveTimer.current)
    historySaveTimer.current=setTimeout(()=>{
      historySaveTimer.current=null
      saveHistory(overrides)
    },250)
    setHistoryVersion(version=>version+1)
  }

  function setCaretAfterNode(node,page){
    const range=document.createRange()
    range.setStartAfter(node);range.collapse(true)
    const selection=window.getSelection()
    page?.focus({preventScroll:true})
    selection?.removeAllRanges();selection?.addRange(range)
    savedRangeRef.current=range.cloneRange()
    activePgRef.current=page
  }

  function recordTrackedChange(change){
    setChanges(previous=>{
      const index=previous.findIndex(item=>item.id===change.id)
      if(index<0)return [...previous,change]
      const next=[...previous]
      next[index]={...next[index],...change}
      return next
    })
  }

  function insertTrackedCommandText(value){
    const text=String(value??"")
    if(!trackChanges||!text)return false
    restoreSelection()
    const selection=window.getSelection()
    if(!selection?.rangeCount)return false
    const range=selection.getRangeAt(0)
    const page=pagesRef.current.find(current=>current
      &&current.contains(range.startContainer)
      &&current.contains(range.endContainer))
    if(!page)return false
    saveHistory()
    if(!range.collapsed)deleteTrackedRange(range,page,"selection")
    const liveSelection=window.getSelection()
    const insertionRange=liveSelection?.rangeCount
      ?liveSelection.getRangeAt(0):range
    insertTrackedText(insertionRange,text,page)
    dirtyRef.current=true
    updateStats()
    scheduleTrackedHistory()
    requestAnimationFrame(()=>spillCheck())
    return true
  }

  function deleteTrackedCommand(direction="backward"){
    if(!trackChanges)return false
    const selection=window.getSelection()
    if(!selection?.rangeCount)return false
    const range=selection.getRangeAt(0)
    const page=pagesRef.current.find(current=>current
      &&current.contains(range.startContainer)
      &&current.contains(range.endContainer))
    if(!page)return false
    const testRange=range.cloneRange()
    if(testRange.collapsed&&!expandTrackedDeletion(testRange,page,direction))return false
    saveHistory()
    if(!deleteTrackedRange(range,page,direction))return false
    dirtyRef.current=true
    updateStats()
    scheduleTrackedHistory()
    requestAnimationFrame(()=>spillCheck())
    return true
  }

  function insertTrackedText(range,text,page){
    const startElement=range.startContainer.nodeType===1
      ?range.startContainer
      :range.startContainer.parentElement
    const existingInsertion=startElement?.closest?.('ins[data-tracked-change="insert"]')
    if(existingInsertion&&page.contains(existingInsertion)){
      const textNode=document.createTextNode(text)
      range.deleteContents();range.insertNode(textNode)
      setCaretAfterNode(textNode,page)
      recordTrackedChange({
        id:existingInsertion.dataset.changeId,type:"insert",
        text:existingInsertion.textContent,time:Date.now(),
      })
      return
    }
    const id=`chg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
    const time=Date.now()
    const insertion=document.createElement("ins")
    insertion.dataset.trackedChange="insert"
    insertion.dataset.changeId=id
    insertion.dataset.changeTime=String(time)
    insertion.style.cssText="color:#185abd;text-decoration:none;"
    insertion.textContent=text
    range.deleteContents();range.insertNode(insertion)
    setCaretAfterNode(insertion,page)
    recordTrackedChange({id,type:"insert",text,time})
  }

  function insertTrackedParagraph(page){
    const selection=window.getSelection()
    if(!selection?.rangeCount)return false
    let range=selection.getRangeAt(0)
    if(!page.contains(range.startContainer)||!page.contains(range.endContainer))return false
    if(!range.collapsed){
      deleteTrackedRange(range,page,"selection")
      const live=window.getSelection()
      if(!live?.rangeCount)return false
      range=live.getRangeAt(0)
    }
    let block=range.startContainer.nodeType===1
      ?range.startContainer
      :range.startContainer.parentElement
    while(block&&block.parentElement!==page)block=block.parentElement
    if(!block||block===page||!block.matches("p,div,h1,h2,h3,h4,h5,h6,blockquote,pre")){
      block=document.createElement("p")
      block.innerHTML="<br>"
      range.insertNode(block)
      range=document.createRange()
      range.selectNodeContents(block)
      range.collapse(true)
    }
    const newBlock=block.cloneNode(false)
    newBlock.removeAttribute("id")
    newBlock.removeAttribute("data-click-flow")
    const tail=document.createRange()
    tail.setStart(range.startContainer,range.startOffset)
    tail.setEnd(block,block.childNodes.length)
    const fragment=tail.extractContents()
    if(fragment.childNodes.length)newBlock.appendChild(fragment)
    block.parentNode.insertBefore(newBlock,block.nextSibling)
    if(!block.textContent&&!block.querySelector("img,table,[data-shape],[data-chart]"))
      block.innerHTML="<br>"
    const id=`chg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
    const time=Date.now()
    const marker=document.createElement("ins")
    marker.dataset.trackedChange="insert"
    marker.dataset.changeKind="paragraph"
    marker.dataset.changeId=id
    marker.dataset.changeTime=String(time)
    marker.contentEditable="false"
    marker.textContent="\u200B"
    marker.title="Inserted paragraph break"
    marker.style.cssText="display:inline-block;width:0;border-left:2px solid #185abd;text-decoration:none;"
    newBlock.insertBefore(marker,newBlock.firstChild)
    if(!newBlock.textContent.replace(/\u200B/g,"")&&!newBlock.querySelector("br"))
      newBlock.appendChild(document.createElement("br"))
    const caret=document.createRange()
    caret.setStartAfter(marker);caret.collapse(true)
    page.focus({preventScroll:true})
    selection.removeAllRanges();selection.addRange(caret)
    savedRangeRef.current=caret.cloneRange()
    activePgRef.current=page
    recordTrackedChange({id,type:"insert",kind:"paragraph",text:"Paragraph break",time})
    return true
  }

  // Insert a real paragraph and explicitly move the live selection into it.
  // Browser-default contentEditable Enter could add a line while leaving the
  // visible caret attached to the previous line.
  function insertDocumentParagraph(page){
    const selection=window.getSelection()
    if(!page||!selection?.rangeCount)return false
    let range=selection.getRangeAt(0)
    if(!page.contains(range.startContainer)||!page.contains(range.endContainer))return false
    if(!range.collapsed){
      range.deleteContents()
      range=selection.getRangeAt(0)
    }

    let block=range.startContainer.nodeType===1
      ?range.startContainer
      :range.startContainer.parentElement
    while(block&&block!==page&&block.parentElement!==page)block=block.parentElement

    const supported=block&&block!==page
      &&block.matches?.("p,div,h1,h2,h3,h4,h5,h6,blockquote,pre")
    let newBlock
    if(supported){
      // Completing a heading or quotation returns to normal body text.
      const tag=block.matches("h1,h2,h3,h4,h5,h6,blockquote,pre")
        ?"p"
        :block.tagName.toLowerCase()
      newBlock=document.createElement(tag)
      if(tag===block.tagName.toLowerCase()){
        newBlock.style.cssText=block.style.cssText
        newBlock.className=block.className
      }
      const tail=document.createRange()
      tail.setStart(range.startContainer,range.startOffset)
      tail.setEnd(block,block.childNodes.length)
      newBlock.appendChild(tail.extractContents())
      block.parentNode.insertBefore(newBlock,block.nextSibling)
      if(!block.textContent&&!block.querySelector("img,table,[data-shape],[data-chart]"))
        block.innerHTML="<br>"
    }else{
      // Normalize text directly under the page into a paragraph so the caret
      // always has a stable editable line to live in.
      newBlock=document.createElement("p")
      newBlock.style.direction=page.style.direction||"rtl"
      newBlock.style.textAlign=page.style.textAlign||"right"
      try{
        const tail=document.createRange()
        tail.setStart(range.startContainer,range.startOffset)
        tail.setEnd(page,page.childNodes.length)
        newBlock.appendChild(tail.extractContents())
      }catch{
        // Pagination can briefly detach a selection. An empty paragraph is a
        // safe destination and is preferable to jumping to the first line.
      }
      page.appendChild(newBlock)
    }
    if(!newBlock.textContent&&!newBlock.querySelector("img,table,[data-shape],[data-chart]"))
      newBlock.innerHTML="<br>"

    page.focus({preventScroll:true})
    const caret=document.createRange()
    const firstText=document.createTreeWalker(newBlock,NodeFilter.SHOW_TEXT).nextNode()
    if(firstText)caret.setStart(firstText,0)
    else{caret.selectNodeContents(newBlock);caret.collapse(true)}
    caret.collapse(true)
    selection.removeAllRanges();selection.addRange(caret)
    savedRangeRef.current=caret.cloneRange()
    activePgRef.current=page
    pendingSpillCursorRef.current=getCursorPos()
    dirtyRef.current=true
    return true
  }

  function expandTrackedDeletion(range,page,direction){
    if(!range.collapsed)return true
    const node=range.startContainer
    if(node.nodeType===Node.TEXT_NODE){
      const offset=range.startOffset
      if(direction==="backward"&&offset>0){
        range.setStart(node,offset-1)
        return true
      }
      if(direction==="forward"&&offset<node.textContent.length){
        range.setEnd(node,offset+1)
        return true
      }
    }
    // At the start/end of an inline span or paragraph, let the browser find
    // the adjacent visual character. This keeps Backspace/Delete tracked
    // across formatting boundaries instead of silently performing an
    // untracked native deletion.
    const selection=window.getSelection()
    if(typeof selection?.modify==="function"){
      selection.removeAllRanges()
      selection.addRange(range)
      selection.modify("extend",direction==="forward"?"forward":"backward","character")
      if(selection.rangeCount){
        const expanded=selection.getRangeAt(0).cloneRange()
        if(!expanded.collapsed
          &&page.contains(expanded.startContainer)
          &&page.contains(expanded.endContainer)){
          range.setStart(expanded.startContainer,expanded.startOffset)
          range.setEnd(expanded.endContainer,expanded.endOffset)
          selection.removeAllRanges()
          selection.addRange(range)
          return true
        }
      }
      selection.removeAllRanges()
      selection.addRange(range)
    }
    return false
  }

  function deleteTrackedRange(range,page,direction){
    if(!expandTrackedDeletion(range,page,direction))return false
    const startElement=range.startContainer.nodeType===1
      ?range.startContainer:range.startContainer.parentElement
    const endElement=range.endContainer.nodeType===1
      ?range.endContainer:range.endContainer.parentElement
    const startInsertion=startElement?.closest?.('ins[data-tracked-change="insert"]')
    const endInsertion=endElement?.closest?.('ins[data-tracked-change="insert"]')
    if(startInsertion&&startInsertion===endInsertion&&page.contains(startInsertion)){
      const id=startInsertion.dataset.changeId
      range.deleteContents()
      if(!(startInsertion.textContent||"").replace(/\u200B/g,"")){
        startInsertion.remove()
        setChanges(previous=>previous.filter(change=>change.id!==id))
      }else{
        recordTrackedChange({
          id,type:"insert",text:startInsertion.textContent,time:Date.now(),
        })
      }
      const selection=window.getSelection()
      selection?.removeAllRanges();selection?.addRange(range)
      savedRangeRef.current=range.cloneRange()
      activePgRef.current=page
      return true
    }
    const id=`chg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
    const time=Date.now()
    const fragment=range.extractContents()
    const deletion=document.createElement("del")
    deletion.dataset.trackedChange="delete"
    deletion.dataset.changeId=id
    deletion.dataset.changeTime=String(time)
    deletion.contentEditable="false"
    deletion.style.cssText="color:#c0392b;text-decoration:line-through;background:#fdecec;"
    deletion.appendChild(fragment)
    const text=deletion.textContent||""
    range.insertNode(deletion)
    setCaretAfterNode(deletion,page)
    recordTrackedChange({id,type:"delete",text,time})
    return true
  }

  function handleTrackedBeforeInput(event,page){
    if(!trackChanges||!page)return
    const nativeEvent=event.nativeEvent||event
    const inputType=nativeEvent.inputType||""
    const selection=window.getSelection()
    if(!selection?.rangeCount)return
    const range=selection.getRangeAt(0)
    if(!page.contains(range.startContainer)||!page.contains(range.endContainer))return
    const insertedText=nativeEvent.data
      ||nativeEvent.dataTransfer?.getData?.("text/plain")
      ||""
    if((inputType==="insertText"||inputType==="insertCompositionText"||inputType==="insertFromPaste")&&insertedText){
      event.preventDefault()
      saveHistory()
      if(!range.collapsed)deleteTrackedRange(range,page,"selection")
      const currentSelection=window.getSelection()
      const insertionRange=currentSelection?.rangeCount?currentSelection.getRangeAt(0):range
      insertTrackedText(insertionRange,insertedText,page)
    }else if(inputType==="insertParagraph"||inputType==="insertLineBreak"){
      event.preventDefault()
      saveHistory()
      if(!insertTrackedParagraph(page))return
    }else if(inputType==="deleteContentBackward"||inputType==="deleteContentForward"
      ||inputType==="deleteByCut"){
      const direction=inputType==="deleteContentForward"?"forward":"backward"
      const testRange=range.cloneRange()
      if(testRange.collapsed&&!expandTrackedDeletion(testRange,page,direction))return
      event.preventDefault()
      saveHistory()
      deleteTrackedRange(range,page,direction)
    }else return
    dirtyRef.current=true
    updateStats()
    scheduleTrackedHistory()
    requestAnimationFrame(()=>spillCheck())
  }

  function applyTrackedInsertAppearance(enabled){
    pagesRef.current.filter(Boolean).forEach(page=>{
      page.querySelectorAll('ins[data-tracked-change="insert"]').forEach(node=>{
        if(node.dataset.changeKind==="paragraph"){
          node.style.borderLeftColor=enabled?"#185abd":"transparent"
          return
        }
        node.style.color=enabled?"#185abd":"inherit"
        node.style.textDecoration="none"
        node.style.textDecorationColor="currentColor"
        node.style.backgroundColor="transparent"
      })
      page.querySelectorAll('del[data-tracked-change="delete"]').forEach(node=>{
        node.style.color=enabled?"#c0392b":"inherit"
        node.style.backgroundColor=enabled?"#fdecec":"transparent"
      })
    })
  }

  function toggleTrackChanges(){
    const enabled=!trackChanges
    saveHistory()
    setTrackChanges(enabled)
    applyTrackedInsertAppearance(enabled)
    dirtyRef.current=true
    setTimeout(()=>saveHistory({trackChanges:enabled}),0)
    showToast(enabled?"Track Changes turned on":"Track Changes turned off")
  }

  function acceptAllChanges(){
    if(!changes.length)return
    saveHistory()
    pagesRef.current.filter(Boolean).forEach(page=>{
      page.querySelectorAll('ins[data-tracked-change="insert"]').forEach(node=>{
        if(node.dataset.changeKind==="paragraph")node.remove()
        else node.replaceWith(...Array.from(node.childNodes))
      })
      page.querySelectorAll('del[data-tracked-change="delete"]').forEach(node=>node.remove())
    })
    setChanges([])
    dirtyRef.current=true
    updateStats()
    scheduleTrackedHistory({changes:[]})
    requestAnimationFrame(()=>spillCheck())
    showToast("All tracked changes accepted")
  }

  function rejectAllChanges(){
    if(!changes.length)return
    saveHistory()
    pagesRef.current.filter(Boolean).forEach(page=>{
      page.querySelectorAll('ins[data-tracked-change="insert"]').forEach(node=>{
        if(node.dataset.changeKind==="paragraph"){
          const block=node.parentElement
          const previous=block?.previousElementSibling
          node.remove()
          if(block&&previous&&block.parentElement===previous.parentElement){
            if(!(previous.textContent||"").replace(/\u200B/g,""))
              previous.querySelectorAll("br").forEach(br=>br.remove())
            previous.append(...Array.from(block.childNodes))
            block.remove()
          }else block?.remove()
        }else node.remove()
      })
      page.querySelectorAll('del[data-tracked-change="delete"]').forEach(node=>
        node.replaceWith(...Array.from(node.childNodes)))
    })
    setChanges([])
    dirtyRef.current=true
    updateStats()
    scheduleTrackedHistory({changes:[]})
    requestAnimationFrame(()=>spillCheck())
    showToast("All tracked changes rejected")
  }

  useEffect(()=>{
    const openComment=event=>{
      const anchor=event.target.closest?.("[data-comment-id]")
      if(!anchor)return
      setActiveCommentId(anchor.dataset.commentId)
      setShowComments(true)
    }
    document.addEventListener("click",openComment)
    return()=>document.removeEventListener("click",openComment)
  },[])

  // ── FEATURE 4: Image Editor ───────────────────────────────────────────────
  function openImageEditor(src, callback) {
    setImageEditorSrc(src)
    setImageEditorCallback(()=>callback)
    setShowImageEditor(true)
  }
  function editExistingImage(wrapper){
    const image=wrapper?.querySelector("img");if(!image)return
    openImageEditor(image.src,styleString=>{
      saveHistory()
      image.style.cssText=`${image.style.cssText};${styleString};max-width:100%;display:block;`
      dirtyRef.current=true;setSelectedShape(wrapper)
      requestAnimationFrame(()=>spillCheck())
    })
    setContextMenu(null)
  }

  function insertEditedImage(src, styleStr) {
    exec("insertHTML", `<img src="${src}" style="${styleStr};max-width:100%;"/>`)
  }

  // Override insertImage to go through editor
  function insertImageWithEditor(src, width, align) {
    openImageEditor(src, (styleStr) => {
      exec("insertHTML", `<span class="img-wrap" style="display:inline-block;position:relative;line-height:0;"><img src="${src}" style="${styleStr};width:${width}px;max-width:100%;"/></span>`)
      setTimeout(()=>pagesRef.current.filter(Boolean).forEach(p=>window._irs?.(p)), 80)
    })
  }

  // ── Word-like paragraph styles ────────────────────────────────────────────
  function renumberNumberedHeadings(){
    let number=0
    pagesRef.current.filter(Boolean).forEach(pg=>{
      pg.querySelectorAll('[data-numbered-heading="true"]').forEach(block=>{
        number++
        let label=block.querySelector(":scope > [data-heading-number]")
        if(!label){
          label=document.createElement("span")
          label.setAttribute("data-heading-number","true")
          label.setAttribute("contenteditable","false")
          label.style.userSelect="none"
          block.insertBefore(label,block.firstChild)
        }
        const nextLabel=`1.${number} `
        if(label.textContent!==nextLabel)label.textContent=nextLabel
      })
    })
  }

  function applyParagraphStyle(styleName){
    restoreSelection()
    const selection=window.getSelection()
    if(!selection||!selection.rangeCount)return
    const originalRange=selection.getRangeAt(0).cloneRange()
    const anchor=selection.anchorNode?.nodeType===1
      ?selection.anchorNode
      :selection.anchorNode?.parentElement
    const page=pagesRef.current.find(pg=>pg&&pg.contains(anchor))
    if(!page)return

    if(["subtleEmphasis","emphasis"].includes(styleName)){
      saveHistory()
      const characterStyles={
        subtleEmphasis:{fontStyle:"italic",fontWeight:"400",color:"#5b9bd5"},
        emphasis:{fontStyle:"italic",fontWeight:"600",color:""},
      }
      const style=characterStyles[styleName]
      if(originalRange.collapsed){
        const span=document.createElement("span")
        span.setAttribute("data-word-character-style",styleName)
        span.setAttribute("data-typing-marker","1")
        Object.assign(span.style,style)
        span.appendChild(document.createTextNode("\u200B"))
        originalRange.insertNode(span)
        const caret=document.createRange()
        caret.setStart(span.firstChild,1);caret.collapse(true)
        selection.removeAllRanges();selection.addRange(caret)
        savedRangeRef.current=caret.cloneRange()
      }else{
        const fragment=originalRange.extractContents()
        fragment.querySelectorAll?.("[data-word-character-style]").forEach(child=>{
          child.removeAttribute("data-word-character-style")
          child.style.fontStyle=""
          child.style.fontWeight=""
          child.style.color=""
        })
        const span=document.createElement("span")
        span.setAttribute("data-word-character-style",styleName)
        Object.assign(span.style,style)
        span.appendChild(fragment)
        originalRange.insertNode(span)
        const selected=document.createRange()
        selected.selectNodeContents(span)
        selection.removeAllRanges();selection.addRange(selected)
        savedRangeRef.current=selected.cloneRange()
      }
      dirtyRef.current=true
      updateStats()
      requestAnimationFrame(()=>spillCheck())
      return
    }

    saveHistory()
    const tag=styleName==="numbered"
      ?"h2"
      :["noSpacing","subtitle"].includes(styleName)?"p":styleName
    document.execCommand("formatBlock",false,tag)

    const liveSelection=window.getSelection()
    const liveRange=liveSelection?.rangeCount?liveSelection.getRangeAt(0):originalRange
    const liveAnchor=liveSelection?.anchorNode?.nodeType===1
      ?liveSelection.anchorNode
      :liveSelection?.anchorNode?.parentElement
    const selector="p,h1,h2,h3,h4,blockquote,pre"
    let blocks=liveRange.collapsed
      ?[liveAnchor?.closest?.(selector)].filter(block=>block&&page.contains(block))
      :Array.from(page.querySelectorAll(selector))
        .filter(block=>{try{return liveRange.intersectsNode(block)}catch{return false}})
    if(!blocks.length){
      const block=liveAnchor?.closest?.(selector)
      if(block&&page.contains(block))blocks=[block]
    }

    const styleMap={
      h1:{fontSize:"24px",fontWeight:"700",fontFamily:"var(--theme-heading-font)",color:"var(--theme-accent1)",borderBottom:"2px solid var(--theme-accent1)",paddingBottom:"4px",marginBottom:"8px"},
      h2:{fontSize:"20px",fontWeight:"700",fontFamily:"var(--theme-heading-font)",color:"var(--theme-accent1)",marginBottom:"6px"},
      h3:{fontSize:"16px",fontWeight:"700",fontFamily:"var(--theme-heading-font)",color:"var(--theme-accent2)",marginBottom:"4px"},
      h4:{fontSize:"14px",fontWeight:"700",fontFamily:"var(--theme-heading-font)",color:"var(--theme-muted)",marginBottom:"3px"},
      subtitle:{
        fontSize:"15px",
        fontWeight:"400",
        color:"var(--theme-muted)",
        fontStyle:"italic",
        lineHeight:"1.15",
        marginTop:"0",
        marginBottom:"8px",
      },
      blockquote:{
        marginInlineStart:"36px",
        marginInlineEnd:"36px",
        marginTop:"0",
        marginBottom:"8px",
        lineHeight:"1.15",
        color:"var(--theme-muted)",
        fontStyle:"italic",
        textAlign:"center",
      },
      p:{lineHeight:"1.15",marginTop:"0",marginBottom:"8px"},
      noSpacing:{lineHeight:"1",marginTop:"0",marginBottom:"0"},
    }
    const resetProperties=[
      "fontSize","fontWeight","color","borderBottom","paddingBottom",
      "marginTop","marginBottom","marginBlockStart","marginBlockEnd",
      "marginInlineStart","marginInlineEnd","lineHeight","borderLeft",
      "borderRight","paddingLeft","paddingRight","fontStyle","background","padding",
      "fontFamily","direction","textAlign","whiteSpace",
    ]
    blocks.forEach(block=>{
      resetProperties.forEach(property=>{block.style[property]=""})
      block.querySelectorAll(":scope > [data-heading-number]").forEach(number=>number.remove())
      block.removeAttribute("data-numbered-heading")
      block.setAttribute("data-word-style",styleName)
      Object.assign(block.style,styleMap[styleName]||styleMap[tag]||styleMap.p)
      if(styleName==="numbered")block.setAttribute("data-numbered-heading","true")
    })

    // Number labels are separate non-editable spans. They never overwrite the
    // heading's text/spans, so font formatting and the caret remain intact.
    renumberNumberedHeadings()

    dirtyRef.current=true
    if(liveSelection?.rangeCount)savedRangeRef.current=liveSelection.getRangeAt(0).cloneRange()
    requestAnimationFrame(()=>spillCheck())
  }

  useEffect(()=>{
    const handleDocumentLink=event=>{
      const tocLink=event.target.closest?.("a[data-toc-link]")
      if(tocLink){
        event.preventDefault();event.stopPropagation()
        const target=document.getElementById(tocLink.dataset.tocLink)
        const page=pagesRef.current.find(current=>current?.contains(target))
        if(target&&page){
          target.scrollIntoView({behavior:"smooth",block:"center"})
          page.focus({preventScroll:true})
          const range=document.createRange();range.selectNodeContents(target);range.collapse(true)
          const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
          savedRangeRef.current=range.cloneRange();activePgRef.current=page
        }
        return
      }
      const link=event.target.closest?.('a[data-word-link="true"]')
      if(link&&(event.ctrlKey||event.metaKey)){
        event.preventDefault();window.open(link.href,"_blank","noopener,noreferrer")
      }
    }
    document.addEventListener("click",handleDocumentLink)
    return()=>document.removeEventListener("click",handleDocumentLink)
  },[])
  useEffect(()=>{
    const openMenu=event=>{
      const link=event.target.closest?.('a[data-word-link="true"]')
      if(!link)return
      event.preventDefault();event.stopPropagation()
      setLinkContext({x:event.clientX,y:event.clientY,element:link})
    }
    const closeMenu=event=>{if(!event.target.closest?.("#link-context-menu"))setLinkContext(null)}
    document.addEventListener("contextmenu",openMenu)
    document.addEventListener("mousedown",closeMenu)
    return()=>{document.removeEventListener("contextmenu",openMenu);document.removeEventListener("mousedown",closeMenu)}
  },[])

  function clearAll(){
    showModal({
      type:"danger",
      title:"Clear Document",
      message:"Delete all content on every page? You can restore it immediately with Undo.",
      onConfirm:()=>{
        closeModal()
        if(historySaveTimer.current){
          clearTimeout(historySaveTimer.current)
          historySaveTimer.current=null
        }
        // Preserve the complete current document before the destructive edit.
        saveHistory()
        flushSync(()=>setPageCount(1))
        const firstPage=pagesRef.current[0]
        if(firstPage)firstPage.innerHTML="<p><br></p>"
        savedRangeRef.current=null
        activePgRef.current=firstPage||null
        setComments([])
        setChanges([])
        setShowComments(false)
        setActiveCommentId(null)
        dirtyRef.current=true
        updateStats()
        saveHistory({comments:[],changes:[]})
        requestAnimationFrame(()=>focusPageCaret(firstPage,false))
        showToast("Document cleared — use Undo to restore it")
      },
    })
  }

  function allPgs(){return pagesRef.current.filter(Boolean)}

  useEffect(()=>()=>{
    // Component unmount — stop any pending debounced work from firing
    // against refs/state that no longer belong to a mounted page.
    clearTimeout(spillTimer.current)
    if(spillFrameRef.current)cancelAnimationFrame(spillFrameRef.current)
    clearTimeout(historySaveTimer.current)
    clearTimeout(savedMsgTimerRef.current)
  },[])


  useEffect(()=>{const sc=document.createElement("script");sc.textContent=IMG_JS;document.head.appendChild(sc);return()=>sc.remove()},[])

  useEffect(()=>{
    if(initialDocId){
      authFetch(`/documents/${initialDocId}`).then(r=>r.json()).then(doc=>{
        setDocId(doc.id||doc._id); docIdRef.current=doc.id||doc._id
        setDocTitle(doc.title); docTitleRef.current=doc.title
        if(A4[doc.orientation])setOrientation(doc.orientation)
        if(doc.pageMargins&&["top","bottom","left","right"].every(side=>Number.isFinite(Number(doc.pageMargins[side])))){
          setPageMargins({...doc.pageMargins,top:Number(doc.pageMargins.top),bottom:Number(doc.pageMargins.bottom),left:Number(doc.pageMargins.left),right:Number(doc.pageMargins.right)})
        }
        let storedHTML=doc.html||""
        let embeddedSettings={}
        const settingsMatch=storedHTML.match(/<!-- KASHUR_SETTINGS:([^]*?) -->/)
        if(settingsMatch){
          try{embeddedSettings=JSON.parse(decodeURIComponent(settingsMatch[1]))}catch{}
          storedHTML=storedHTML.replace(settingsMatch[0],"")
        }
        const loadedTheme=DOCUMENT_THEMES[doc.theme||embeddedSettings.theme]
          ?(doc.theme||embeddedSettings.theme)
          :"Office"
        const loadedPageColor=doc.pageColor||embeddedSettings.pageColor||DOCUMENT_THEMES[loadedTheme].page
        setTheme(loadedTheme)
        setPageColor(loadedPageColor)
        setPageBorderStyle(doc.pageBorderStyle||embeddedSettings.pageBorderStyle||"none")
        setPageBorderWidth(Number(doc.pageBorderWidth||embeddedSettings.pageBorderWidth)||1)
        setPageBorderColor(doc.pageBorderColor||embeddedSettings.pageBorderColor||"#2b579a")
        setPageBorderSetting(doc.pageBorderSetting||embeddedSettings.pageBorderSetting
          ||((doc.pageBorderStyle||embeddedSettings.pageBorderStyle||"none")==="none"?"none":"box"))
        setPageBorderSides(doc.pageBorderSides||embeddedSettings.pageBorderSides
          ||{top:true,right:true,bottom:true,left:true})
        const loadedWatermark=doc.watermark||embeddedSettings.watermark
        if(loadedWatermark)setWatermark({
          type:loadedWatermark.type==="text"&&String(loadedWatermark.text||"").trim()?"text":"none",
          text:String(loadedWatermark.text||"").slice(0,80),
          font:String(loadedWatermark.font||"'Segoe UI', Arial, sans-serif"),
          size:Math.max(24,Math.min(120,Number(loadedWatermark.size)||56)),
          color:/^#[0-9a-f]{6}$/i.test(String(loadedWatermark.color||""))
            ?loadedWatermark.color:"#b8b8b8",
          opacity:Math.max(.05,Math.min(.8,Number(loadedWatermark.opacity)||.28)),
          layout:loadedWatermark.layout==="horizontal"?"horizontal":"diagonal",
        })
        const loadedComments=Array.isArray(doc.comments)
          ?doc.comments
          :Array.isArray(embeddedSettings.comments)?embeddedSettings.comments:[]
        const loadedChanges=Array.isArray(doc.changes)
          ?doc.changes
          :Array.isArray(embeddedSettings.changes)?embeddedSettings.changes:[]
        const loadedTracking=Boolean(doc.trackChanges??embeddedSettings.trackChanges)
        setComments(loadedComments)
        setChanges(loadedChanges)
        setTrackChanges(loadedTracking)
        setActiveCommentId(null)
        const parts=storedHTML.split("\n<!-- PAGE_BREAK -->\n").filter(p=>p.trim())
        setPageCount(Math.max(1,parts.length))
        setTimeout(()=>{
          parts.forEach((html,i)=>{
            if(!pagesRef.current[i])return
            pagesRef.current[i].innerHTML=html
            pagesRef.current[i].style.background=loadedPageColor
            paintDocumentTheme(pagesRef.current[i],loadedTheme)
          })
          if(!loadedChanges.length)setChanges(collectTrackedChangesFromDocument())
          applyTrackedInsertAppearance(loadedTracking)
          initAllObjects()
          updateStats()
          setTimeout(spillCheck, 200)
          resetHistory()
          focusPageCaret(pagesRef.current[0])
        }, 120)
      }).catch(e=>{console.error("Load doc:",e);showToast("Failed to load document","error")})
    }else{
      setTimeout(()=>{
        if(pagesRef.current[0]&&!pagesRef.current[0].innerHTML.trim())
          pagesRef.current[0].innerHTML=DEFAULT_HTML
        updateStats()
        resetHistory()
        focusPageCaret(pagesRef.current[0])
      },80)
    }
  },[initialDocId])

  // ADMIN PANEL ADDITION — autosave interval/enabled now follows Editor
  // Settings instead of a hardcoded 30s. Re-runs whenever settings load.
  useEffect(()=>{
    clearInterval(autoSaveTimer.current)
    if (editorSettings && editorSettings.autoSaveEnabled === false) return
    const intervalMs = ((editorSettings?.autoSaveInterval) || 30) * 1000
    autoSaveTimer.current=setInterval(()=>{
      if(dirtyRef.current)saveNowRef.current?.(true)
    },intervalMs)
    return ()=>clearInterval(autoSaveTimer.current)
  },[editorSettings])

  useEffect(()=>{
    const fn=e=>{const ctrl=e.ctrlKey||e.metaKey
      const target=e.target
      const formField=target?.closest?.("input,textarea,select")
      const selection=window.getSelection()
      const inDocument=!formField&&selection?.anchorNode
        &&pagesRef.current.some(page=>page&&page.contains(selection.anchorNode))
      if(ctrl&&e.key.toLowerCase()==="c"&&inDocument){e.preventDefault();copyDocumentSelection();return}
      if(ctrl&&e.key.toLowerCase()==="x"&&inDocument){e.preventDefault();cutDocumentSelection();return}
      if(ctrl&&e.key.toLowerCase()==="v"&&inDocument){e.preventDefault();pasteDocumentClipboard();return}
      if(ctrl&&e.key==="z"){e.preventDefault();customUndo();return}
      if(ctrl&&(e.key==="y"||(e.shiftKey&&e.key==="Z"))){e.preventDefault();customRedo();return}
      if(ctrl&&e.shiftKey&&e.key.toLowerCase()==="s"){e.preventDefault();promptSaveAs();return}
      if(ctrl&&e.key==="s"){e.preventDefault();saveNow()}
      if(ctrl&&e.key.toLowerCase()==="o"){e.preventDefault();requestDocumentTransition(()=>setShowOpen(true),"Open Another Document");return}
      if(ctrl&&e.key.toLowerCase()==="w"){e.preventDefault();requestDocumentTransition(
        ()=>onBackToDashboard?onBackToDashboard():resetToNewDocument(),"Close Document");return}
      if(ctrl&&e.key==="p"){e.preventDefault();spillCheck();doPrintPopup(pagesRef,fontFamily,orientation,headerText,footerText,pageNumber,{setting:pageBorderSetting,style:pageBorderStyle,width:pageBorderWidth,color:pageBorderColor,sides:pageBorderSides},fontSize,lineSpacing,{headerAlign,footerAlign,pageNumberPosition,pageNumberFormat,pageNumberStart},DOCUMENT_THEMES[theme],pageColor,watermark)}
      if(ctrl&&e.key==="Enter"){e.preventDefault();insertPageBreak()};if(e.key==="F2"){e.preventDefault();handleRename()}
      if(ctrl&&e.key.toLowerCase()==="n"){e.preventDefault();newDoc();return}
    }
    document.addEventListener("keydown",fn);return()=>document.removeEventListener("keydown",fn)
  },[fontFamily,orientation,headerText,footerText,pageNumber,pageBorderSetting,pageBorderStyle,pageBorderWidth,pageBorderColor,pageBorderSides,theme,pageColor,watermark,trackChanges,docCounter,onBackToDashboard])

  useEffect(()=>{const fn=e=>{if(fMenuRef.current&&!fMenuRef.current.contains(e.target))setFileOpen(false)};document.addEventListener("mousedown",fn);return()=>document.removeEventListener("mousedown",fn)},[])


  useEffect(()=>{
    function handlePhoneticKeyDown(e){
      if(!phoneticModeRef.current)return
      const skip=["Control","Alt","Meta","Shift","CapsLock","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown","Tab","Escape","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"]
      if(skip.includes(e.key))return;if(e.ctrlKey||e.metaKey)return
      const pg=activePgRef.current||pagesRef.current[0];if(!pg)return
      const sel=window.getSelection();if(!sel||!pg.contains(sel.anchorNode))return
      if(e.altKey){const altChar=PHONETIC_ALT_MAP[e.key.toLowerCase()];if(altChar){e.preventDefault();phoneticBuffer.current="";if(!insertTrackedCommandText(altChar))document.execCommand("insertText",false,altChar);dirtyRef.current=true;updateStats()};return}
      if(["Enter","Backspace","Delete"].includes(e.key)){phoneticBuffer.current="";return}
      if(e.key===" "){phoneticBuffer.current="";return}
      if(e.key.length!==1)return
      e.preventDefault()
      const rawChar=e.key,buf=(phoneticBuffer.current+rawChar).slice(-PHONETIC_BUFFER_SIZE)
      phoneticBuffer.current=buf
      let matched=null,matchLen=0
      for(const key of PHONETIC_KEYS){if(key.length<=buf.length&&buf.endsWith(key)){matched=PHONETIC_MAP_RAW[key];matchLen=key.length;break}}
      if(!matched){if(!insertTrackedCommandText(rawChar))document.execCommand("insertText",false,rawChar);return}
      for(let i=0;i<matchLen-1;i++)document.execCommand("delete",false)
      if(!insertTrackedCommandText(matched))document.execCommand("insertText",false,matched);dirtyRef.current=true;updateStats()
    }
    document.addEventListener("keydown",handlePhoneticKeyDown,true)
    return()=>document.removeEventListener("keydown",handlePhoneticKeyDown,true)
  },[updateStats,trackChanges])

  const {w:pageW,h:pageH}=A4[orientation]
  const clampZoom=value=>Math.min(2,Math.max(.5,Number(value)||1))
  const setViewZoom=value=>setZoom(clampZoom(value))
  const changeZoom=delta=>
    setZoom(current=>clampZoom(parseFloat((current+delta).toFixed(1))))
  function switchDocumentView(mode){
    setReadMode(false)
    setDocumentView(mode==="web"?"web":"print")
    requestAnimationFrame(()=>{
      spillCheck()
      requestAnimationFrame(()=>spillCheck())
      const current=pageAreaRef.current?.querySelector(
        `[data-page-shell="${activeViewPage}"]`)
      current?.scrollIntoView({block:"start",inline:"center"})
    })
  }
  const goToReadPage=useCallback((requested,behavior="smooth")=>{
    const index=Math.max(0,Math.min(pageCount-1,Number(requested)||0))
    setReadPageIndex(index)
    requestAnimationFrame(()=>{
      readAreaRef.current?.querySelector(`[data-read-page="${index}"]`)
        ?.scrollIntoView({behavior,block:"start",inline:"center"})
    })
  },[pageCount])
  function enterReadMode(){
    const target=Math.max(0,Math.min(pageCount-1,activeViewPage))
    setReadPageIndex(target)
    setReadZoom(1)
    setReadMode(true)
    requestAnimationFrame(()=>requestAnimationFrame(()=>goToReadPage(target,"auto")))
  }
  useEffect(()=>{
    if(!readMode)return
    setReadPageIndex(index=>Math.max(0,Math.min(pageCount-1,index)))
    const handleReadKeys=event=>{
      if(event.key==="Escape"){
        setReadMode(false)
        return
      }
      if(["ArrowRight","PageDown"," "].includes(event.key)){
        event.preventDefault()
        goToReadPage(readPageIndex+1)
      }else if(["ArrowLeft","PageUp"].includes(event.key)){
        event.preventDefault()
        goToReadPage(readPageIndex-1)
      }else if(event.key==="Home"){
        goToReadPage(0)
      }else if(event.key==="End"){
        goToReadPage(pageCount-1)
      }
    }
    document.addEventListener("keydown",handleReadKeys)
    return()=>document.removeEventListener("keydown",handleReadKeys)
  },[readMode,pageCount,readPageIndex,goToReadPage])
  const activeDocumentTheme=DOCUMENT_THEMES[theme]||DOCUMENT_THEMES.Office
  const navigationHeadings=pagesRef.current.filter(Boolean).flatMap((page,pageIndex)=>
    Array.from(page.querySelectorAll(
      "h1,h2,h3,[data-word-style='h1'],[data-word-style='h2'],[data-word-style='h3']"))
      .map((element,index)=>({
        element,pageIndex,index,
        level:element.matches("h1,[data-word-style='h1']")?1
          :element.matches("h2,[data-word-style='h2']")?2:3,
        text:(element.innerText||element.textContent||"").trim(),
      })).filter(item=>item.text)
  )
  const normalizedNavigationQuery=navigationQuery.trim().toLocaleLowerCase()
  const navigationResults=normalizedNavigationQuery
    ?pagesRef.current.filter(Boolean).flatMap((page,pageIndex)=>
      Array.from(page.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,td,th"))
        .map((element,index)=>({
          element,pageIndex,index,
          text:(element.innerText||element.textContent||"").replace(/\s+/g," ").trim(),
        }))
        .filter(item=>item.text.toLocaleLowerCase().includes(normalizedNavigationQuery))
    ).slice(0,100)
    :[]
  const DK={bg:dark?"#111827":"#f0f4f8",text:dark?"#f3f4f6":"#1f2937",page:dark?"#292929":"#808080"}
  const HFHEIGHT=32   // real pixels, header/footer height pre-zoom
  const canUndoNow=historyIdx.current>0||Boolean(historySaveTimer.current)
  const canRedoNow=historyIdx.current>=0&&historyIdx.current<historyStack.current.length-1

  return(
  <div style={{display:"flex",flexDirection:"column",height:"100vh",fontFamily:"Segoe UI,sans-serif",overflow:"hidden",minHeight:600,background:dark?"#1e1e1e":"#f0f0f0",color:dark?"#f3f4f6":"#1f2937"}}>

    {/* ── QUICK ACCESS TOOLBAR + TITLE BAR (exact MS Word 365 layout) ─── */}
    <div style={{
      background: WORD_BLUE,
      color:"#fff",
      display:"flex",
      alignItems:"center",
      height:32,
      paddingLeft:8,
      paddingRight:8,
      userSelect:"none",
      flexShrink:0,
      gap:0,
    }}>
      {/* Kashur Editor Chinar mark */}
      <div title="Kashur Editor" aria-label="Kashur Editor Chinar logo"
        style={{width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="23" height="23" viewBox="0 0 24 24" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="chinarLeaf" x1="4" y1="3" x2="20" y2="19" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffb52e"/>
              <stop offset=".48" stopColor="#f06a24"/>
              <stop offset="1" stopColor="#b42318"/>
            </linearGradient>
          </defs>
          <path d="M12 1.5l2.15 4.1 3.65-1.85-.72 4.28 4.27.32-3.3 2.86 2.65 2.18-6.05 1.22.72 4.55-3.37-2.42-3.37 2.42.72-4.55-6.05-1.22 2.65-2.18-3.3-2.86 4.27-.32-.72-4.28 3.65 1.85L12 1.5z"
            fill="url(#chinarLeaf)" stroke="#8e2f1f" strokeWidth=".55" strokeLinejoin="round"/>
          <path d="M12 15.7v6.4" stroke="#7a321d" strokeWidth="1.35" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Quick Access Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:1,marginRight:8}}>
        {onBackToDashboard&&(
          <button onClick={handleBackToDashboard}
            style={{background:"transparent",border:"none",color:"rgba(255,255,255,.85)",
              padding:"4px 6px",cursor:"pointer",fontSize:13,borderRadius:2,display:"flex",alignItems:"center",gap:4}}
            title="Dashboard"
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            ← Dashboard
          </button>
        )}
        {[
          {icon:"💾",title:"Save (Ctrl+S)",fn:()=>saveNow(),disabled:saving||!docTitle.trim()},
          {icon:"↩",title:"Undo (Ctrl+Z)",fn:()=>customUndo(),disabled:!canUndoNow},
          {icon:"↪",title:"Redo (Ctrl+Y)",fn:()=>customRedo(),disabled:!canRedoNow},
        ].map(({icon,title,fn,disabled})=>(
          <button key={title} title={title} aria-label={title} disabled={disabled} onClick={fn}
            style={{background:"transparent",border:"none",color:"rgba(255,255,255,.9)",
              width:26,height:26,cursor:disabled?"default":"pointer",fontSize:14,borderRadius:2,
              display:"flex",alignItems:"center",justifyContent:"center",
              opacity:disabled ? .42 : 1}}
            onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background="rgba(255,255,255,.18)"}}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            {icon}
          </button>
        ))}
      </div>

      {/* Document title — centered */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,minWidth:0}}>
        <span
          onDoubleClick={handleRename}
          title="Double-click to rename"
          style={{fontSize:13,fontWeight:400,cursor:"pointer",
            maxWidth:340,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
            color:"rgba(255,255,255,.95)"}}>
          {docTitle}
        </span>
        {savedMsg&&(
          <span style={{fontSize:11,color:savedMsg.includes("✗")||savedMsg.includes("⚠")?"#fca5a5":"rgba(255,255,255,.7)"}}>
            {savedMsg}
          </span>
        )}
        {saving&&<span style={{fontSize:11,color:"rgba(255,255,255,.6)"}}>Saving…</span>}
        {trackChanges&&<span style={{fontSize:10,background:"rgba(192,57,43,.5)",borderRadius:2,padding:"1px 6px"}}>Track Changes</span>}
      </div>

      {/* Right side controls */}
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        {comments.length>0&&(
          <button onClick={()=>setShowComments(v=>!v)}
            style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:2,
              padding:"2px 8px",fontSize:11,cursor:"pointer"}}>
            💬 {comments.length}
          </button>
        )}
        <button onMouseDown={e=>e.preventDefault()} onClick={()=>setKbOpen(v=>!v)}
          aria-pressed={kbOpen} title={kbOpen?"Close Kashur keyboard":"Open Kashur keyboard"}
          style={{background:kbOpen?"rgba(255,255,255,.28)":"transparent",
            border:"none",color:"rgba(255,255,255,.9)",borderRadius:2,
            padding:"2px 8px",fontSize:12,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.18)"}
          onMouseLeave={e=>e.currentTarget.style.background=kbOpen?"rgba(255,255,255,.28)":"transparent"}>
          ⌨ Kashur Keyboard
        </button>
        <button onMouseDown={e=>e.preventDefault()} onClick={()=>{setPhoneticMode(v=>!v);phoneticBuffer.current=""}}
          aria-pressed={phoneticMode} title="Toggle phonetic typing"
          style={{background:phoneticMode?"rgba(255,220,50,.35)":"transparent",
            border:"none",color:"rgba(255,255,255,.9)",borderRadius:2,
            padding:"2px 8px",fontSize:12,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.18)"}
          onMouseLeave={e=>e.currentTarget.style.background=phoneticMode?"rgba(255,220,50,.35)":"transparent"}>
          🌐 {phoneticMode?"Phonetic ON":"Phonetic"}
        </button>
        <button onMouseDown={e=>e.preventDefault()} onClick={toggleEditorDark}
          aria-label={dark?"Switch to light mode":"Switch to dark mode"}
          aria-pressed={dark}
          title={dark?"Light mode":"Dark mode"}
          style={{background:dark?"rgba(255,255,255,.2)":"transparent",
            border:"none",color:"rgba(255,255,255,.9)",
            borderRadius:2,padding:"2px 6px",fontSize:14,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.18)"}
          onMouseLeave={e=>e.currentTarget.style.background=dark?"rgba(255,255,255,.2)":"transparent"}>
          {dark?"☀️":"🌙"}
        </button>
      </div>
    </div>

    {/* ── RIBBON TAB BAR — ─────────────────────────── */}
    <div style={{
      background: WORD_BLUE,
      display:"flex",
      alignItems:"flex-end",
      paddingLeft:4,
      flexShrink:0,
      borderBottom: `2px solid ${WORD_BLUE}`,
    }}>
      {[...TABS,...(activeTable?["Table Design","Table Layout"]:[])].map(tab=>{
        const isFile=tab==="File", isActive=!isFile&&activeTab===tab
        const isTableContext=tab==="Table Design"||tab==="Table Layout"
        return(<div key={tab} ref={isFile?fMenuRef:null}
          data-table-context-tab={isTableContext?"true":undefined}
          style={{position:"relative"}}>
          {isFile ? (
            /* FILE button — filled rectangle, stands apart */
            <button onClick={()=>setFileOpen(v=>!v)}
              style={{
                background: fileOpen ? "#fff" : WORD_BLUE_DARK,
                color: fileOpen ? WORD_BLUE : "#fff",
                border:"none",
                padding:"5px 16px",
                fontSize:13,
                fontWeight:600,
                cursor:"pointer",
                height:30,
                borderRadius:"2px 2px 0 0",
                userSelect:"none",
                letterSpacing:0.2,
              }}>
              File
            </button>
          ) : (
            /* Regular tab */
            <button
              onMouseDown={event=>{if(isTableContext)event.stopPropagation()}}
              onClick={event=>{if(isTableContext)event.stopPropagation();setActiveTab(tab);setFileOpen(false)}}
              style={{
                background: isActive ? "#f5f5f5" : "transparent",
                color: isActive ? (tab==="Table Design"?"#8a5a00":WORD_BLUE) : (tab==="Table Design"?"#ffe08a":"rgba(255,255,255,.92)"),
                border:"none",
                padding:"5px 14px",
                fontSize:13,
                fontWeight: isActive ? 600 : 400,
                cursor:"pointer",
                height:30,
                borderRadius:"2px 2px 0 0",
                userSelect:"none",
                letterSpacing:0.1,
              }}
              onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background="rgba(255,255,255,.15)" }}
              onMouseLeave={e=>{ e.currentTarget.style.background=isActive?"#f5f5f5":"transparent" }}>
              {tab}
            </button>
          )}
          {/* File dropdown */}
          {isFile&&fileOpen&&(
            <div style={{position:"absolute",top:"100%",left:0,background:"#1e3a5f",
              width:240,zIndex:10000,borderRadius:"0 4px 4px 4px",
              boxShadow:"0 8px 24px rgba(0,0,0,.45)",padding:"6px 0"}}>
              {FILE_MENU.map((item,i)=>item.label==="divider"
                ?<div key={i} style={{height:1,background:"rgba(255,255,255,.12)",margin:"3px 0"}}/>
                :<FMenuItem key={item.label} item={item} onClick={()=>handleFileAction(item.label)}/>
              )}
            </div>
          )}
        </div>)
      })}
    </div>

    {/* ── RIBBON PANEL ─────────────────────────────────────────────────── */}
    <div style={{
      background: RIBBON_BG,
      borderBottom:`1px solid ${BORDER}`,
      display:"flex",
      alignItems:"stretch",
      flexWrap:"nowrap",
      overflowX:"auto",
      overflowY:"hidden",
      height:88,
      minHeight:88,
      maxHeight:88,
      flexShrink:0,
      boxShadow:"0 1px 3px rgba(0,0,0,.08)",
      padding:"0 4px",
    }}>      {activeTab==="Home"&&<HomeRibbon exec={exec} fontSize={fontSize} setFontSize={setFontSize} fontFamily={fontFamily} setFontFamily={setFontFamily} applyFontSize={applyFontSize} applyFontFamily={applyFontFamily} applyParagraphAlignment={applyParagraphAlignment} applyParagraphIndent={applyParagraphIndent} applyParagraphLineSpacing={applyParagraphLineSpacing} applyParagraphStyle={applyParagraphStyle} insertList={insertList} insertMultilevelList={insertMultilevelList} removeList={removeList} saveSelection={saveSelection} customUndo={customUndo} customRedo={customRedo} copySelection={copyDocumentSelection} cutSelection={cutDocumentSelection} pasteClipboard={pasteDocumentClipboard} canUndo={historyIdx.current>0||Boolean(historySaveTimer.current)} canRedo={historyIdx.current>=0&&historyIdx.current<historyStack.current.length-1} clearAllFormatting={clearAllFormatting} showParagraphMarks={showParagraphMarks} setShowParagraphMarks={setShowParagraphMarks}/>}
      {activeTab==="Insert"&&<InsertRibbon exec={exec} openTableDlg={()=>setShowTable(true)} insertTable={insertTable} openImageDlg={()=>setShowImage(true)} insertDate={insertDate} insertDateTime={insertDateTime} insertLink={insertLink} insertShape={insertShape} insertChart={insertChart} openChartEditor={()=>{setChartEditorTarget(null);setShowChartEditor(true)}} openTOC={()=>setShowTOC(true)} applyHeaderPreset={applyHeaderPreset} applyFooterPreset={applyFooterPreset} applyPageNumberPreset={applyPageNumberPreset} removeHeader={removeHeader} removeFooter={removeFooter} removePageNumber={removePageNumber} showHeader={showHeader} showFooter={showFooter} pageNumber={pageNumber} openCoverPage={openCoverPage} insertBlankPage={insertBlankPage} insertPageBreak={insertPageBreak} insertTextBox={insertTextBox} openTextBoxDlg={()=>setShowTextBoxDlg(true)} insertHorizontalLine={insertHorizontalLine} customShapes={customShapes} insertCustomShape={insertCustomShape}/>}
      {activeTab==="Layout"&&<LayoutRibbon orientation={orientation} onOrientationChange={changePageOrientation} pagesRef={pagesRef} pageMargins={pageMargins} onPageMarginsChange={changePageMargins} indentLeft={indentLeft} setIndentLeft={setIndentLeft} indentRight={indentRight} setIndentRight={setIndentRight} spaceBefore={spaceBefore} setSpaceBefore={setSpaceBefore} spaceAfter={spaceAfter} setSpaceAfter={setSpaceAfter} applyLayoutParagraphFormat={applyLayoutParagraphFormat} theme={theme} pageColor={pageColor} onApplyPageColor={applyDocumentPageColor} pageBorderSetting={pageBorderSetting} pageBorderStyle={pageBorderStyle} pageBorderWidth={pageBorderWidth} pageBorderColor={pageBorderColor} pageBorderSides={pageBorderSides} onApplyPageBorder={applyDocumentPageBorder}/>}
      {activeTab==="Review"&&<ReviewRibbon clearAll={clearAll} docTitle={docTitle} onTitleChange={changeDocumentTitle} onTitleBlur={commitDocumentTitle} saveNow={saveNow} saving={saving} savedMsg={savedMsg} customUndo={customUndo} customRedo={customRedo} selectAll={selectAllDocument} canUndo={historyIdx.current>0||Boolean(historySaveTimer.current)} canRedo={historyIdx.current>=0&&historyIdx.current<historyStack.current.length-1} showWordCount={showWordCountDialog}/>}
      {activeTab==="Comments"&&<CommentsRibbon addComment={addComment} showComments={showComments} setShowComments={setShowComments} comments={comments} trackChanges={trackChanges} toggleTrackChanges={toggleTrackChanges} changes={changes} acceptAllChanges={acceptAllChanges} rejectAllChanges={rejectAllChanges}/>}
      {activeTab==="View"&&<ViewRibbon zoom={zoom} changeZoom={changeZoom}
        setViewZoom={setViewZoom} readMode={readMode} enterReadMode={enterReadMode}
        showNavigationPane={showNavigationPane} setShowNavigationPane={setShowNavigationPane}
        documentView={documentView} switchDocumentView={switchDocumentView}/>}
      {activeTab==="Table Design"&&activeTable&&<TableDesignRibbon table={activeTable}
        applyStyle={tableApplyStyle} toggleOption={tableToggleOption} setCellShading={tableSetBg}
        setBorderColor={(table,value)=>tableBorderPart(table,"color",value)}
        setBorderWidth={(table,value)=>tableBorderPart(table,"width",value)}
        setBorderStyle={(table,value)=>tableBorderPart(table,"style",value)}/>}
      {activeTab==="Table Layout"&&activeTable&&<TableLayoutRibbon
        insertRow={before=>tableInsertRowRelative(activeTable,before)}
        insertColumn={before=>tableInsertColumnRelative(activeTable,before)}
        deleteRow={()=>tableDelRow(activeTable)} deleteColumn={()=>tableDelCol(activeTable)}
        deleteCell={()=>tableDeleteCell(activeTable)} deleteTable={()=>tableDelete(activeTable)}
        mergeCells={()=>tableMergeCells(activeTable)} splitCell={()=>tableSplitCell(activeTable)}
        splitTable={()=>tableSplitTable(activeTable)}/>}
    </div>
    {/* READ MODE — paged, non-editing document reader */}
    {readMode&&<div style={{position:"fixed",inset:0,background:"#4b4b4b",
      zIndex:9000,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{height:48,background:"#242424",color:"#fff",display:"flex",
        alignItems:"center",justifyContent:"space-between",padding:"0 18px",
        flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,.35)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <span style={{fontSize:18}}>📖</span>
          <span style={{fontWeight:600,fontSize:13,whiteSpace:"nowrap",
            overflow:"hidden",textOverflow:"ellipsis"}}>{docTitle}</span>
          <span style={{fontSize:11,color:"#bbb"}}>Read Mode</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <button onClick={()=>setReadZoom(value=>Math.max(.7,value-.1))}
            disabled={readZoom<=.7} title="Decrease reading size"
            style={{background:"transparent",border:"1px solid #666",color:"#fff",
              width:28,height:27,borderRadius:3,cursor:"pointer"}}>−</button>
          <span style={{fontSize:11,minWidth:40,textAlign:"center"}}>
            {Math.round(readZoom*100)}%
          </span>
          <button onClick={()=>setReadZoom(value=>Math.min(1.5,value+.1))}
            disabled={readZoom>=1.5} title="Increase reading size"
            style={{background:"transparent",border:"1px solid #666",color:"#fff",
              width:28,height:27,borderRadius:3,cursor:"pointer"}}>+</button>
          <button onClick={()=>setReadMode(false)}
            style={{marginLeft:8,background:"#fff",border:"1px solid #ddd",
              color:"#222",borderRadius:4,padding:"6px 14px",fontSize:11,
              cursor:"pointer",fontWeight:600}}>Close Read Mode</button>
        </div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"stretch",overflow:"hidden"}}>
        <button onClick={()=>goToReadPage(readPageIndex-1)}
          disabled={readPageIndex===0} title="Previous page"
          style={{width:54,flexShrink:0,border:"none",background:"rgba(0,0,0,.15)",
            color:"#fff",fontSize:30,cursor:readPageIndex===0?"default":"pointer",
            opacity:readPageIndex===0 ? .25 : 1}}>‹</button>
        <div ref={readAreaRef} style={{flex:1,overflow:"auto",padding:"24px",
          display:"flex",flexDirection:"column",alignItems:"center",gap:24}}
          onScroll={event=>{
            const area=event.currentTarget
            const pages=Array.from(area.querySelectorAll("[data-read-page]"))
            if(!pages.length)return
            const areaTop=area.getBoundingClientRect().top
            const nearest=pages.reduce((best,page)=>{
              const distance=Math.abs(page.getBoundingClientRect().top-areaTop-24)
              return !best||distance<best.distance?{page,distance}:best
            },null)
            const index=Number(nearest?.page?.dataset.readPage)
            if(Number.isInteger(index)&&index!==readPageIndex)setReadPageIndex(index)
          }}>
          {pagesRef.current.filter(Boolean).map((currentReadPage,pageIndex)=>{
            const currentReadLabel=formatPageLabel(
              pageNumberStart+pageIndex,pageCount,pageNumberFormat)
            const readBorderVisible=pageBorderSetting!=="none"
              &&pageBorderStyle!=="none"
            const readBorderValue=`${Math.max(1,pageBorderWidth*4/3*readZoom)}px ${pageBorderStyle} ${pageBorderColor}`
            const readHeaderDecoration=headerStyle==="banded"
              ?{background:"#eaf2fb",borderBottom:"3px solid #2b579a"}
              :headerStyle==="austin"
                ?{background:"#fff",borderBottom:"3px double #2b579a"}
                :headerStyle==="facet"
                  ?{background:"linear-gradient(90deg,#2b579a 0 8px,#f8fbff 8px)",borderBottom:"1px solid #b8c8dc"}
                  :{background:"transparent",borderBottom:"1px solid #e0e0e0"}
            const readFooterDecoration=footerStyle==="banded"
              ?{background:"#eaf2fb",borderTop:"3px solid #2b579a"}
              :footerStyle==="austin"
                ?{background:"#fff",borderTop:"3px double #2b579a"}
                :footerStyle==="facet"
                  ?{background:"linear-gradient(90deg,#2b579a 0 8px,#f8fbff 8px)",borderTop:"1px solid #b8c8dc"}
                  :{background:"transparent",borderTop:"1px solid #e0e0e0"}
            return(
              <div key={pageIndex} data-read-page={pageIndex}
                style={{width:Math.round(pageW*readZoom),
                  height:Math.round(pageH*readZoom),
                  background:pageColor||"#fff",
                  boxShadow:readPageIndex===pageIndex
                    ?"0 0 0 2px rgba(24,90,189,.7),0 5px 28px rgba(0,0,0,.5)"
                    :"0 4px 24px rgba(0,0,0,.45)",
                  borderTop:readBorderVisible&&pageBorderSides.top?readBorderValue:"none",
                  borderRight:readBorderVisible&&pageBorderSides.right?readBorderValue:"none",
                  borderBottom:readBorderVisible&&pageBorderSides.bottom?readBorderValue:"none",
                  borderLeft:readBorderVisible&&pageBorderSides.left?readBorderValue:"none",
                  boxSizing:"border-box",position:"relative",flexShrink:0,overflow:"hidden"}}>
                <div style={{width:pageW,height:pageH,
                  transform:`scale(${readZoom})`,transformOrigin:"top left",
                  position:"relative",background:pageColor||"#fff",
                  boxSizing:"border-box",
                  padding:`${Math.max(48,Number(pageMargins.top)||0)}px ${Math.max(48,Number(pageMargins.right)||0)}px ${Math.max(48,Number(pageMargins.bottom)||0)}px ${Math.max(48,Number(pageMargins.left)||0)}px`,
                  fontFamily:"var(--theme-body-font)",fontSize:fontSize+"px",
                  lineHeight:lineSpacing,color:activeDocumentTheme.text,
                  direction:"rtl",wordBreak:"break-word",overflowWrap:"break-word",
                  "--theme-text":activeDocumentTheme.text,
                  "--theme-muted":activeDocumentTheme.muted,
                  "--theme-accent1":activeDocumentTheme.accent1,
                  "--theme-accent2":activeDocumentTheme.accent2,
                  "--theme-accent3":activeDocumentTheme.accent3,
                  "--theme-heading-font":activeDocumentTheme.headingFont,
                  "--theme-body-font":activeDocumentTheme.bodyFont}}>
                  {watermark.type==="text"&&watermark.text&&(
                    <div aria-hidden="true" style={{position:"absolute",inset:0,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      pointerEvents:"none",userSelect:"none",zIndex:1,overflow:"hidden"}}>
                      <span style={{fontFamily:watermark.font,fontSize:`${watermark.size}px`,
                        color:watermark.color,opacity:watermark.opacity,fontWeight:600,
                        whiteSpace:"nowrap",letterSpacing:2,
                        transform:watermark.layout==="horizontal"?"none":"rotate(-45deg)",
                        transformOrigin:"center",direction:"auto"}}>
                        {watermark.text}
                      </span>
                    </div>
                  )}
                  {showHeader&&<div style={{position:"absolute",top:0,left:0,right:0,
                    height:34,...readHeaderDecoration,display:"flex",alignItems:"center",
                    padding:`0 ${Math.max(48,Number(pageMargins.right)||0)}px 0 ${Math.max(48,Number(pageMargins.left)||0)}px`,
                    boxSizing:"border-box",zIndex:4,fontSize:11,color:"#666",
                    textAlign:headerAlign,direction:"auto"}}>
                    <span style={{width:"100%",whiteSpace:"pre-wrap"}}>{headerText}</span>
                  </div>}
                  <div style={{position:"relative",zIndex:2}}
                    dangerouslySetInnerHTML={{__html:currentReadPage.innerHTML}}/>
                  {showFooter&&<div style={{position:"absolute",bottom:0,left:0,right:0,
                    height:34,...readFooterDecoration,display:"flex",alignItems:"center",
                    padding:`0 ${Math.max(48,Number(pageMargins.right)||0)}px 0 ${Math.max(48,Number(pageMargins.left)||0)}px`,
                    boxSizing:"border-box",zIndex:4,fontSize:11,color:"#666",
                    textAlign:footerAlign,direction:"auto"}}>
                    <span style={{width:"100%",whiteSpace:"pre-wrap"}}>{footerText}</span>
                  </div>}
                  {pageNumber&&<div style={{position:"absolute",
                    top:pageNumberPosition.startsWith("top")?16:"auto",
                    bottom:pageNumberPosition.startsWith("bottom")?16:"auto",
                    left:48,right:48,fontSize:11,color:"#666",zIndex:5,
                    textAlign:pageNumberPosition.endsWith("left")?"left"
                      :pageNumberPosition.endsWith("right")?"right":"center"}}>
                    {currentReadLabel}
                  </div>}
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={()=>goToReadPage(readPageIndex+1)}
          disabled={readPageIndex>=pageCount-1} title="Next page"
          style={{width:54,flexShrink:0,border:"none",background:"rgba(0,0,0,.15)",
            color:"#fff",fontSize:30,cursor:readPageIndex>=pageCount-1?"default":"pointer",
            opacity:readPageIndex>=pageCount-1 ? .25 : 1}}>›</button>
      </div>
      <div style={{height:28,background:"#242424",color:"#ddd",display:"flex",
        alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0}}>
        Page {readPageIndex+1} of {pageCount} · Use arrow keys or Page Up/Page Down
      </div>
    </div>}

    {/* PAGE AREA */}
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      {showNavigationPane&&(
        <aside style={{width:245,flexShrink:0,background:"#f7f7f7",
          borderRight:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",
          overflow:"hidden"}}>
          <div style={{height:36,padding:"0 12px",display:"flex",alignItems:"center",
            justifyContent:"space-between",borderBottom:`1px solid ${BORDER}`,
            background:"#fff",fontSize:12,fontWeight:600,color:"#333"}}>
            <span>Navigation</span>
            <button onClick={()=>setShowNavigationPane(false)} title="Close Navigation Pane"
              style={{border:"none",background:"transparent",fontSize:18,cursor:"pointer",
                color:"#666",lineHeight:1}}>×</button>
          </div>
          <div style={{padding:8,background:"#fff",borderBottom:`1px solid ${BORDER}`}}>
            <div style={{display:"flex",alignItems:"center",border:"1px solid #aaa",
              borderRadius:3,background:"#fff",padding:"0 6px"}}>
              <span style={{fontSize:12,color:"#777"}}>⌕</span>
              <input value={navigationQuery}
                onChange={event=>setNavigationQuery(event.target.value)}
                placeholder="Search document"
                style={{minWidth:0,flex:1,border:"none",outline:"none",padding:"6px",
                  fontSize:11,background:"transparent"}}/>
              {navigationQuery&&<button onClick={()=>setNavigationQuery("")}
                style={{border:"none",background:"transparent",cursor:"pointer",
                  color:"#777",fontSize:14}}>×</button>}
            </div>
          </div>
          {!navigationQuery&&(
            <div style={{display:"flex",background:"#fff",borderBottom:`1px solid ${BORDER}`}}>
              {["headings","pages"].map(tab=>(
                <button key={tab} onClick={()=>setNavigationTab(tab)}
                  style={{flex:1,padding:"7px 4px",border:"none",
                    borderBottom:navigationTab===tab?`2px solid ${WORD_BLUE}`:"2px solid transparent",
                    background:"#fff",color:navigationTab===tab?WORD_BLUE:"#555",
                    fontSize:11,fontWeight:navigationTab===tab?600:400,cursor:"pointer"}}>
                  {tab==="headings"?"Headings":"Pages"}
                </button>
              ))}
            </div>
          )}
          <div style={{padding:8,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
            {navigationQuery
              ?navigationResults.length
                ?navigationResults.map(result=>(
                  <button key={`${result.pageIndex}_${result.index}`}
                    onClick={()=>{
                      setActiveViewPage(result.pageIndex)
                      result.element.scrollIntoView({behavior:"smooth",block:"center"})
                    }}
                    style={{textAlign:"left",padding:"7px 8px",border:"none",
                      borderBottom:"1px solid #e3e3e3",background:"#fff",
                      cursor:"pointer",fontSize:10.5,lineHeight:1.4,color:"#333"}}>
                    <span style={{display:"block",color:WORD_BLUE,fontSize:9.5,
                      marginBottom:2}}>Page {result.pageIndex+1}</span>
                    {result.text.slice(0,110)}{result.text.length>110?"…":""}
                  </button>
                ))
                :<div style={{fontSize:11,color:"#888",padding:14,textAlign:"center"}}>
                  No results found
                </div>
              :navigationTab==="headings"
                ?navigationHeadings.length
                  ?navigationHeadings.map(heading=>(
                    <button key={`${heading.pageIndex}_${heading.index}`}
                      onClick={()=>{
                        setActiveViewPage(heading.pageIndex)
                        heading.element.scrollIntoView({behavior:"smooth",block:"center"})
                      }}
                      style={{textAlign:"left",padding:`6px 7px 6px ${7+(heading.level-1)*14}px`,
                        border:"none",background:"#fff",cursor:"pointer",
                        fontSize:heading.level===1?11.5:11,
                        fontWeight:heading.level===1?600:400,color:"#333"}}>
                      {heading.text}
                    </button>
                  ))
                  :<div style={{fontSize:11,color:"#888",padding:16,textAlign:"center",
                    lineHeight:1.5}}>Apply Heading 1–3 styles to see the document structure here.</div>
                :Array.from({length:pageCount}).map((_,index)=>{
                  const preview=(pagesRef.current[index]?.innerText||"")
                    .replace(/\s+/g," ").trim().slice(0,72)
                  return(
                    <button key={index} onClick={()=>{
                      setActiveViewPage(index)
                      document.querySelector(`[data-page-shell="${index}"]`)
                        ?.scrollIntoView({behavior:"smooth",block:"start",inline:"center"})
                    }}
                      style={{textAlign:"left",padding:"8px 9px",borderRadius:5,cursor:"pointer",
                        border:`${activeViewPage===index?2:1}px solid ${activeViewPage===index?WORD_BLUE:"#d1d1d1"}`,
                        background:activeViewPage===index?"#eaf2fb":"#fff",color:"#333"}}>
                      <span style={{display:"block",fontSize:11,fontWeight:700,
                        color:activeViewPage===index?WORD_BLUE:"#444"}}>Page {index+1}</span>
                      <span style={{display:"block",fontSize:10,color:"#777",marginTop:3,
                        whiteSpace:"normal",lineHeight:1.35}}>
                        {preview||"Blank page"}
                      </span>
                    </button>
                  )
                })
            }
          </div>
        </aside>
      )}
      <div ref={pageAreaRef} style={{
        flex:1,
        background:dark
          ?"#25272b"
          :documentView==="web"?"#ffffff":"#a5a5a5",
        overflow:"auto",
        display:"flex",
        flexDirection:"column",
        flexWrap:"nowrap",
        alignContent:"flex-start",
        justifyContent:"flex-start",
        alignItems:"center",
        padding:documentView==="web"?"0":"24px 0 48px",
        gap:documentView==="web"?0:20,
      }} onClick={()=>setFileOpen(false)} onScroll={event=>{
        const area=event.currentTarget
        const shells=Array.from(area.querySelectorAll("[data-page-shell]"))
        if(!shells.length)return
        const areaTop=area.getBoundingClientRect().top
        const nearest=shells.reduce((best,shell)=>{
          const distance=Math.abs(shell.getBoundingClientRect().top-areaTop-12)
          return !best||distance<best.distance?{shell,distance}:best
        },null)
        const index=Number(nearest?.shell?.dataset.pageShell)
        if(Number.isInteger(index)&&index!==activeViewPage)setActiveViewPage(index)
      }}>
        {Array.from({length:pageCount}).map((_,i)=>{
          const marginTop=Number(pageMargins.top)||0
          const marginBottom=Number(pageMargins.bottom)||0
          const marginLeft=Number(pageMargins.left)||0
          const marginRight=Number(pageMargins.right)||0
          const hfH=34
          const pageNumberAtTop=pageNumber&&pageNumberPosition.startsWith("top")
          const pageNumberAtBottom=pageNumber&&!pageNumberAtTop
          const hasTopBand=documentView==="print"&&(showHeader||pageNumberAtTop)
          const hasBottomBand=documentView==="print"&&(showFooter||pageNumberAtBottom)
          const pgContentH=pageH-(hasTopBand?hfH:0)-(hasBottomBand?hfH:0)
          const headerDecoration=headerStyle==="banded"
            ?{background:"#eaf2fb",borderBottom:"3px solid #2b579a"}
            :headerStyle==="austin"
              ?{background:"#fff",borderBottom:"3px double #2b579a"}
              :headerStyle==="facet"
                ?{background:"linear-gradient(90deg,#2b579a 0 8px,#f8fbff 8px)",borderBottom:"1px solid #b8c8dc"}
                :{background:"#fafafa",borderBottom:"1px solid #e0e0e0"}
          const footerDecoration=footerStyle==="banded"
            ?{background:"#eaf2fb",borderTop:"3px solid #2b579a"}
            :footerStyle==="austin"
              ?{background:"#fff",borderTop:"3px double #2b579a"}
              :footerStyle==="facet"
                ?{background:"linear-gradient(90deg,#2b579a 0 8px,#f8fbff 8px)",borderTop:"1px solid #b8c8dc"}
                :{background:"#fafafa",borderTop:"1px solid #e0e0e0"}
          const pageLabel=formatPageLabel(pageNumberStart+i,pageCount,pageNumberFormat)
          const pageNumberAlign=pageNumberPosition.endsWith("left")?"flex-start":pageNumberPosition.endsWith("right")?"flex-end":"center"
          const borderVisible=pageBorderSetting!=="none"&&pageBorderStyle!=="none"
          const pageBorderValue=`${pageBorderWidth*4/3*zoom}px ${pageBorderStyle} ${pageBorderColor}`
          return(
          <div key={i} data-page-shell={i} onMouseDown={()=>setActiveViewPage(i)} style={{
            width:Math.round(pageW*zoom),
            height:Math.round(pageH*zoom),
            flexShrink:0,
            position:"relative",
            overflow:"hidden",
            background:pageColor||"#fff",
            border:"none",
            borderTop:documentView==="print"&&borderVisible&&pageBorderSides.top?pageBorderValue:"none",
            borderRight:documentView==="print"&&borderVisible&&pageBorderSides.right?pageBorderValue:"none",
            borderLeft:documentView==="print"&&borderVisible&&pageBorderSides.left?pageBorderValue:"none",
            boxShadow:documentView==="web"
              ?"none"
              :pageBorderSetting==="shadow"
                ?"5px 5px 0 rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.18)"
                :"0 1px 3px rgba(0,0,0,.18),0 4px 14px rgba(0,0,0,.12)",
            borderBottom:documentView==="print"&&borderVisible&&pageBorderSides.bottom
              ?pageBorderValue:"none",
            boxSizing:"border-box",
          }}>
            {/* Inner scaled container — zoom via scale, but pointer-events correct */}
            <div style={{
              position:"absolute",top:0,left:0,
              width:pageW,height:pageH,
              transform:`scale(${zoom})`,transformOrigin:"top left",
              pointerEvents:"auto",
            }}>
              {watermark.type==="text"&&watermark.text&&(
                <div data-document-watermark="true" contentEditable={false}
                  aria-hidden="true"
                  style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
                    justifyContent:"center",pointerEvents:"none",userSelect:"none",
                    zIndex:4,overflow:"hidden"}}>
                  <span style={{fontFamily:watermark.font,fontSize:`${watermark.size}px`,
                    color:watermark.color,opacity:watermark.opacity,fontWeight:600,
                    whiteSpace:"nowrap",letterSpacing:2,
                    transform:watermark.layout==="horizontal"?"none":"rotate(-45deg)",
                    transformOrigin:"center",direction:"auto",unicodeBidi:"plaintext"}}>
                    {watermark.text}
                  </span>
                </div>
              )}
              {/* HEADER */}
              {hasTopBand&&(
                <div style={{position:"absolute",top:0,left:0,right:0,height:hfH,
                  ...headerDecoration,display:"flex",alignItems:"center",
                  padding:`0 ${marginRight}px 0 ${marginLeft}px`,
                  boxSizing:"border-box",zIndex:5}}>
                  {showHeader&&<textarea id={`kashur-header-${i}`} name={`header-${i}`} value={headerText}
                    onChange={e=>setHeaderText(e.target.value)}
                    onKeyDown={e=>e.stopPropagation()}
                    placeholder="Type header…"
                    rows={2}
                    style={{width:"100%",height:"100%",border:"none",outline:"none",fontSize:11,
                      textAlign:headerAlign,color:"#555",background:"transparent",
                      resize:"none",overflowY:"auto",whiteSpace:"pre-wrap",lineHeight:1.25,
                      boxSizing:"border-box",paddingTop:3,paddingBottom:3,
                      paddingRight:pageNumberAtTop&&pageNumberPosition.endsWith("right")?42:0,
                      paddingLeft:pageNumberAtTop&&pageNumberPosition.endsWith("left")?42:0}}/>}
                  {pageNumberAtTop&&<span style={{position:"absolute",left:marginLeft,right:marginRight,
                    display:"flex",justifyContent:pageNumberAlign,pointerEvents:"none",
                    fontSize:11,color:"#666",fontWeight:500}}>{pageLabel}</span>}
                </div>
              )}

              {/* ═══ EDITABLE PAGE CONTENT ═══
                  - Natural size (no inner scale), overflow:hidden clips at A4 boundary
                  - spillCheck moves overflow on the next animation frame
                  - cursor works correctly because there is NO transform on this element */}
              <div
                ref={el=>regPage(i,el)}
                contentEditable
                data-document-theme={theme}
                data-show-paragraph-marks={showParagraphMarks ? "true" : "false"}
                suppressContentEditableWarning
                onMouseDown={()=>{pendingSpillCursorRef.current=null}}
                onFocus={()=>{
                  activePgRef.current=pagesRef.current[i]
                  setActiveViewPage(i)
                }}
                onBeforeInput={event=>handleTrackedBeforeInput(event,pagesRef.current[i])}
                onBlur={e=>{
                  // Clean up any "typing marker" spans (used to apply
                  // font size/family at a bare cursor) that never actually
                  // received typed text, so we don't leave invisible
                  // zero-width-space nodes littered in the saved document.
                  e.currentTarget.querySelectorAll('span[data-typing-marker="1"]').forEach(m=>{
                    if(m.textContent==="\u200B") m.remove()
                  })
                }}
                onInput={()=>{
                  dirtyRef.current=true
                  clearTimeout(spillTimer.current)
                  if(spillFrameRef.current)cancelAnimationFrame(spillFrameRef.current)
                  // Paginate before the browser paints. This prevents the
                  // final line from disappearing briefly under overflow:hidden
                  // and keeps the caret attached to the text as it moves.
                  spillCheck()
                  renumberNumberedHeadings()
                  // Group consecutive keystrokes into one undo step, the
                  // same way Word/Docs do, instead of snapshotting nothing
                  // (previous behaviour) or every single character.
                  clearTimeout(historySaveTimer.current)
                  historySaveTimer.current=setTimeout(()=>{
                    historySaveTimer.current=null
                    saveHistory()
                  },600)
                  setHistoryVersion(version=>version+1)
                }}
                onKeyDown={e=>{
                  const tableSelection=window.getSelection()
                  const tableAnchor=tableSelection?.anchorNode?.nodeType===1
                    ?tableSelection.anchorNode
                    :tableSelection?.anchorNode?.parentElement
                  const tableCell=tableAnchor?.closest?.("td,th")
                  const currentTable=tableCell?.closest?.("table")
                  if(currentTable&&pagesRef.current[i]?.contains(currentTable)){
                    activeTableCellRef.current=tableCell;setActiveTable(currentTable)
                    if(e.key==="Enter"&&!e.ctrlKey&&!e.metaKey){
                      e.preventDefault()
                      if(handleTableEnter(tableCell)){
                        updateStats();requestAnimationFrame(()=>spillCheck())
                      }
                      return
                    }
                    if(e.key==="Tab"&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
                      e.preventDefault()
                      handleTableTab(currentTable,tableCell,e.shiftKey)
                      requestAnimationFrame(()=>spillCheck())
                      return
                    }
                    if(e.key==="ArrowDown"&&!e.shiftKey){
                      const cells=Array.from(currentTable.querySelectorAll("th,td"))
                      if(tableCell===cells[cells.length-1]){
                        const live=tableSelection?.rangeCount?tableSelection.getRangeAt(0):null
                        const tail=document.createRange()
                        if(live){tail.selectNodeContents(tableCell);tail.setStart(live.endContainer,live.endOffset)}
                        if(live&&live.collapsed&&!tail.toString()){
                          e.preventDefault();moveCaretOutsideTable(currentTable,true);return
                        }
                      }
                    }
                    if(e.key==="ArrowUp"&&!e.shiftKey){
                      const first=currentTable.querySelector("th,td")
                      if(tableCell===first){
                        const live=tableSelection?.rangeCount?tableSelection.getRangeAt(0):null
                        const head=document.createRange()
                        if(live){head.selectNodeContents(tableCell);head.setEnd(live.startContainer,live.startOffset)}
                        if(live&&live.collapsed&&!head.toString()){
                          e.preventDefault();moveCaretOutsideTable(currentTable,false);return
                        }
                      }
                    }
                  }
                  if(e.key==="Tab"&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
                    const selection=window.getSelection()
                    const anchor=selection?.anchorNode?.nodeType===1
                      ?selection.anchorNode
                      :selection?.anchorNode?.parentElement
                    const item=anchor?.closest?.("li")
                    if(item&&pagesRef.current[i]?.contains(item)){
                      e.preventDefault()
                      saveHistory()
                      // Word behaviour: Tab creates a sublevel and
                      // Shift+Tab promotes the current list item.
                      if(changeListLevel(item,e.shiftKey,pagesRef.current[i])){
                        dirtyRef.current=true
                        requestAnimationFrame(()=>spillCheck())
                      }
                      return
                    }
                  }
                  if(e.key==="Backspace"&&!e.ctrlKey&&!e.metaKey){
                    const selection=window.getSelection()
                    const anchor=selection?.anchorNode?.nodeType===1
                      ?selection.anchorNode
                      :selection?.anchorNode?.parentElement
                    const item=anchor?.closest?.("li")
                    const page=pagesRef.current[i]
                    const emptyItem=item
                      &&!(item.textContent||"").replace(/\u200B/g,"").trim()
                    if(page&&item&&page.contains(item)&&emptyItem){
                      e.preventDefault()
                      saveHistory()
                      const list=item.parentElement
                      const parentItem=list?.parentElement?.closest?.("li")
                      if(parentItem){
                        // On a nested empty item Word promotes it one level.
                        changeListLevel(item,true,page)
                      }else if(list){
                        // On a top-level empty item Word removes the marker
                        // and leaves a normal paragraph at the same position.
                        const paragraph=document.createElement("p")
                        paragraph.innerHTML="<br>"
                        paragraph.style.direction=page.style.direction||"rtl"
                        paragraph.style.textAlign=page.style.textAlign||"right"
                        list.parentNode.insertBefore(paragraph,list.nextSibling)
                        item.remove()
                        if(!list.querySelector(":scope > li"))list.remove()
                        const range=document.createRange()
                        range.selectNodeContents(paragraph);range.collapse(true)
                        page.focus({preventScroll:true})
                        selection.removeAllRanges();selection.addRange(range)
                        savedRangeRef.current=range.cloneRange()
                      }
                      dirtyRef.current=true
                      requestAnimationFrame(()=>spillCheck())
                      return
                    }
                  }
                  if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){
                    e.preventDefault()
                    insertPageBreak()
                    requestAnimationFrame(()=>spillCheck())
                    return
                  }
                  if(e.key==="Enter"&&!e.ctrlKey&&!e.metaKey){
                    const selection=window.getSelection()
                    const anchor=selection?.anchorNode?.nodeType===1
                      ?selection.anchorNode
                      :selection?.anchorNode?.parentElement
                    const item=anchor?.closest?.("li")
                    const page=pagesRef.current[i]
                    if(item&&page?.contains(item)){
                      e.preventDefault()
                      saveHistory()
                      if(handleListEnter(item,page)){
                        dirtyRef.current=true
                        updateStats()
                        requestAnimationFrame(()=>spillCheck())
                      }
                      return
                    }
                    if(page){
                      e.preventDefault()
                      saveHistory()
                      let inserted=false
                      if(e.shiftKey){
                        insertTextBoxLineBreak(page,e)
                        inserted=true
                      }else if(trackChanges){
                        inserted=insertTrackedParagraph(page)
                        if(inserted)scheduleTrackedHistory()
                      }else{
                        inserted=insertDocumentParagraph(page)
                      }
                      if(inserted){
                        dirtyRef.current=true
                        updateStats()
                        requestAnimationFrame(()=>{
                          resetEmptyCaretLine(page)
                          spillCheck()
                        })
                      }
                      return
                    }
                  }
                  if(e.key==="Backspace"&&!e.ctrlKey&&!e.metaKey){
                    const page=pagesRef.current[i]
                    const selection=window.getSelection()
                    if(page&&i>0&&selection?.rangeCount){
                      const live=selection.getRangeAt(0)
                      if(live.collapsed&&page.contains(live.startContainer)){
                        const before=document.createRange()
                        before.selectNodeContents(page)
                        before.setEnd(live.startContainer,live.startOffset)
                        if(before.toString().length===0){
                          e.preventDefault()
                          if(removeManualPageBoundary(i))return
                          if(!pageHasMeaningfulContent(page)){
                            removeBlankDocumentPage(i,"previous")
                            return
                          }
                          let block=live.startContainer.nodeType===1
                            ?live.startContainer
                            :live.startContainer.parentElement
                          while(block&&block!==page&&block.parentElement!==page)block=block.parentElement
                          const emptyBlock=block&&block!==page
                            &&!(block.textContent||"").replace(/\u200B/g,"").trim()
                          // For an empty first paragraph, Backspace removes the
                          // paragraph break and returns to page 1 without also
                          // deleting the previous character.
                          if(emptyBlock)block.remove()
                          const previous=pagesRef.current[i-1]
                          focusPageCaret(previous,true)
                          if(!emptyBlock){
                            // At an automatic page boundary this is one
                            // continuous document position, so Backspace
                            // removes the preceding character just as Word.
                            xCmd("delete")
                          }
                          dirtyRef.current=true
                          requestAnimationFrame(()=>spillCheck())
                          return
                        }
                      }
                    }
                  }
                  if(e.key==="Delete"&&!e.ctrlKey&&!e.metaKey){
                    // Mirror image of the Backspace merge-logic above: when
                    // the cursor sits at the very END of a page (nothing
                    // after it) and this isn't the last page, Delete should
                    // reach into the START of the next page and merge it
                    // back — exactly like Word does when Delete is pressed
                    // at the end of a page/line, instead of doing nothing.
                    const page=pagesRef.current[i]
                    const pgs=pagesRef.current.filter(Boolean)
                    const selection=window.getSelection()
                    const live=selection?.rangeCount?selection.getRangeAt(0):null
                    if(page&&pgs.length>1&&live?.collapsed
                      &&page.contains(live.startContainer)
                      &&!pageHasMeaningfulContent(page)){
                      e.preventDefault()
                      if(removeManualPageBoundary(i))return
                      removeBlankDocumentPage(
                        i,
                        i<pgs.length-1?"next":"previous"
                      )
                      return
                    }
                    if(page&&i<pgs.length-1&&selection?.rangeCount){
                      if(live.collapsed&&page.contains(live.startContainer)){
                        const after=document.createRange()
                        after.selectNodeContents(page)
                        after.setStart(live.startContainer,live.startOffset)
                        if(after.toString().length===0){
                          e.preventDefault()
                          if(removeManualPageBoundary(i+1))return
                          const next=pagesRef.current[i+1]
                          if(next){
                            if(!pageHasMeaningfulContent(next)){
                              removeBlankDocumentPage(i+1,"previous")
                              return
                            }
                            let block=next.firstChild
                            while(block&&block.nodeType!==1)block=block.nextSibling
                            const emptyBlock=block
                              &&!(block.textContent||"").replace(/\u200B/g,"").trim()
                            // For an empty leading paragraph on the next
                            // page, Delete removes just that paragraph
                            // break and stays put on this page, instead of
                            // also eating a real character from the next
                            // page.
                            if(emptyBlock)block.remove()
                            focusPageCaret(next,false)
                            if(!emptyBlock)xCmd("forwardDelete")
                          }
                          dirtyRef.current=true
                          requestAnimationFrame(()=>spillCheck())
                          return
                        }
                      }
                    }
                  }
                  dirtyRef.current=true
                }}
                onKeyUp={()=>updateStats()}
                style={{
                  position:"absolute",
                  top:hasTopBand?hfH:0,
                  left:0,
                  width:pageW,
                  height:pgContentH,
                  paddingTop:(documentView==="web"
                    ?(i===0?Math.max(24,marginTop):12)
                    :Math.max(12,marginTop-(hasTopBand?hfH:0)))+"px",
                  paddingBottom:(documentView==="web"
                    ?(i===pageCount-1?Math.max(24,marginBottom):12)
                    :Math.max(12,marginBottom-(hasBottomBand?hfH:0)))+"px",
                  paddingLeft:marginLeft+"px",
                  paddingRight:marginRight+"px",
                  outline:"none",
                  fontSize:fontSize+"px",
                  lineHeight:lineSpacing,
                  color:"var(--theme-text)",
                  backgroundColor:pageColor||activeDocumentTheme.page,
                  "--theme-text":activeDocumentTheme.text,
                  "--theme-muted":activeDocumentTheme.muted,
                  "--theme-accent1":activeDocumentTheme.accent1,
                  "--theme-accent2":activeDocumentTheme.accent2,
                  "--theme-accent3":activeDocumentTheme.accent3,
                  "--theme-heading-font":activeDocumentTheme.headingFont,
                  "--theme-body-font":activeDocumentTheme.bodyFont,
                  direction:"rtl",
                  textAlign:"right",
                  fontFamily:"var(--theme-body-font)",
                  wordBreak:"break-word",
                  overflowWrap:"break-word",
                  boxSizing:"border-box",
                  overflow:"hidden",
                  cursor:"text",
                  userSelect:"text",
                }}
              />

              {/* FOOTER */}
              {hasBottomBand&&(
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:hfH,
                  ...footerDecoration,display:"flex",alignItems:"center",
                  padding:`0 ${marginRight}px 0 ${marginLeft}px`,boxSizing:"border-box",zIndex:5}}>
                  {showFooter
                    ?<textarea id={`kashur-footer-${i}`} name={`footer-${i}`} value={footerText}
                        onChange={e=>setFooterText(e.target.value)}
                        onKeyDown={e=>e.stopPropagation()}
                        placeholder="Type footer…"
                        rows={2}
                        style={{width:"100%",height:"100%",border:"none",outline:"none",fontSize:11,color:"#555",
                          textAlign:footerAlign,background:"transparent",
                          resize:"none",overflowY:"auto",whiteSpace:"pre-wrap",lineHeight:1.25,
                          boxSizing:"border-box",paddingTop:3,paddingBottom:3,
                          paddingRight:pageNumberAtBottom&&pageNumberPosition.endsWith("right")?42:0,
                          paddingLeft:pageNumberAtBottom&&pageNumberPosition.endsWith("left")?42:0}}/>
                    :null}
                  {pageNumberAtBottom&&<span style={{position:"absolute",left:marginLeft,right:marginRight,
                    display:"flex",justifyContent:pageNumberAlign,pointerEvents:"none",
                    fontSize:11,color:"#666",fontWeight:500}}>{pageLabel}</span>}
                </div>
              )}

              {/* Faint page number watermark */}
              <div style={{position:"absolute",bottom:hasBottomBand?hfH+2:2,
                left:"50%",transform:"translateX(-50%)",
                fontSize:9,color:"rgba(0,0,0,.07)",userSelect:"none",pointerEvents:"none",
                fontFamily:"Arial,sans-serif"}}>
                {i+1}
              </div>
            </div>
          </div>)
        })}
      </div>
      {/* COMMENTS SIDEBAR */}
      {showComments&&<CommentsSidebar comments={comments} resolveComment={resolveComment} deleteComment={deleteComment} onClose={()=>setShowComments(false)} activeCommentId={activeCommentId} setActiveCommentId={setActiveCommentId}/>}
    </div>


    {/* ── STATUS BAR — exact MS Word 365 ──────────────────────────────── */}
    <div style={{
      background: WORD_BLUE,
      color:"rgba(255,255,255,.9)",
      height:22,
      display:"flex",
      alignItems:"center",
      justifyContent:"space-between",
      paddingLeft:8,
      paddingRight:8,
      fontSize:12,
      flexShrink:0,
      userSelect:"none",
    }}>
      {/* Left — document stats */}
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:12}}>Page {activePgRef.current?pagesRef.current.filter(Boolean).indexOf(activePgRef.current)+1:1} of {pageCount}</span>
        <span style={{width:1,height:12,background:"rgba(255,255,255,.3)",display:"inline-block"}}/>
        <span style={{fontSize:12}}>{wordCount} words</span>
        <span style={{width:1,height:12,background:"rgba(255,255,255,.3)",display:"inline-block"}}/>
        <span style={{fontSize:12}}>{charCount} characters</span>
      </div>
      {/* Right — zoom slider like Word */}
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>Ctrl+S Save · Ctrl+P Print · F2 Rename</span>
        <span style={{width:1,height:12,background:"rgba(255,255,255,.3)",display:"inline-block"}}/>
        {/* Zoom control */}
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={()=>changeZoom(-.1)}
            style={{background:"transparent",border:"none",color:"rgba(255,255,255,.8)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>−</button>
          <div style={{position:"relative",width:80,height:4,background:"rgba(255,255,255,.25)",borderRadius:2}}>
            <div style={{position:"absolute",left:0,top:0,height:4,background:"rgba(255,255,255,.7)",borderRadius:2,width:`${((zoom-.25)/1.75)*100}%`}}/>
            <input type="range" min={25} max={200} step={5} value={Math.round(zoom*100)}
              onChange={e=>setViewZoom(parseInt(e.target.value)/100)}
              style={{position:"absolute",inset:"-6px 0",opacity:0,cursor:"pointer",width:"100%"}}/>
          </div>
          <button onClick={()=>changeZoom(.1)}
            style={{background:"transparent",border:"none",color:"rgba(255,255,255,.8)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>+</button>
          <span style={{fontSize:12,minWidth:36,textAlign:"right"}}>{Math.round(zoom*100)}%</span>
        </div>
      </div>
    </div>

    {/* ✅ FLOATING SHAPE TOOLBAR */}
    {selectedShape&&createPortal(
      <div id="shape-toolbar" style={{
        position:"fixed",
        top:(()=>{try{const r=selectedShape.getBoundingClientRect();return r.top>145?Math.max(8,r.top-128):Math.min(window.innerHeight-132,r.bottom+8)}catch{return 8}})()+"px",
        left:(()=>{try{const r=selectedShape.getBoundingClientRect();return Math.max(8,Math.min(window.innerWidth-500,r.left))}catch{return 8}})()+"px",
        background:"#1e3f6f",color:"#fff",borderRadius:10,padding:"7px 10px",
        display:"flex",alignItems:"center",gap:5,zIndex:99997,flexWrap:"wrap",maxWidth:600,
        boxShadow:"0 6px 28px rgba(0,0,0,.45)",fontSize:12,userSelect:"none",
      }}>
        {selectedShape.hasAttribute?.("data-chart")?<>
          <span style={{fontSize:11,fontWeight:700,padding:"0 5px"}}>📊 Chart</span>
          <button onMouseDown={event=>event.preventDefault()} onClick={()=>openExistingChartEditor(selectedShape)}
            style={{background:"#fff",border:"none",color:WORD_BLUE,borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>Edit Data</button>
          <button onMouseDown={event=>event.preventDefault()} onClick={()=>{selectedShape.style.width="380px";selectedShape.style.height="260px";refreshSelectedShape(value=>value+1)}}
            style={{background:"rgba(255,255,255,.16)",border:"none",color:"#fff",borderRadius:4,padding:"4px 9px",cursor:"pointer",fontSize:11}}>Reset Size</button>
          <button onMouseDown={event=>event.preventDefault()} title="Delete chart" onClick={deleteSelectedShape}
            style={{background:"#c0392b",border:"none",color:"#fff",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:13}}>🗑</button>
          <button onMouseDown={event=>event.preventDefault()} title="Close toolbar"
            onClick={()=>{const indicator=selectedShape.querySelector(".shape-sel-indicator");if(indicator)indicator.style.display="none";selectedShape.querySelectorAll(".shape-handle").forEach(handle=>handle.remove());setSelectedShape(null);setContextMenu(null)}}
            style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:15,fontWeight:700,lineHeight:1}}>×</button>
        </>:<>
        {/* Size W/H */}
        <span style={{fontSize:10,opacity:.7}}>W:</span>
        <input type="number" min={30} max={800} value={selectedShape.offsetWidth||120}
          onChange={e=>resizeSelectedObject(selectedShape,"width",e.target.value)}
          onClick={e=>e.stopPropagation()}
          style={{width:50,padding:"2px 4px",borderRadius:3,border:"none",fontSize:12,background:"rgba(255,255,255,.15)",color:"#fff"}}/>
        <span style={{fontSize:10,opacity:.7}}>H:</span>
        <input type="number" min={20} max={800} value={selectedShape.offsetHeight||100}
          onChange={e=>resizeSelectedObject(selectedShape,"height",e.target.value)}
          onClick={e=>e.stopPropagation()}
          style={{width:50,padding:"2px 4px",borderRadius:3,border:"none",fontSize:12,background:"rgba(255,255,255,.15)",color:"#fff"}}/>
        {/* Resize quick */}
        <button onMouseDown={e=>e.preventDefault()} title="Grow" onClick={()=>{resizeSelectedObject(selectedShape,"width",selectedShape.offsetWidth+20);resizeSelectedObject(selectedShape,"height",selectedShape.offsetHeight+20)}} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 7px",cursor:"pointer"}}>+</button>
        <button onMouseDown={e=>e.preventDefault()} title="Shrink" onClick={()=>{resizeSelectedObject(selectedShape,"width",selectedShape.offsetWidth-20);resizeSelectedObject(selectedShape,"height",selectedShape.offsetHeight-20)}} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 7px",cursor:"pointer"}}>−</button>
        <div style={{width:1,height:20,background:"rgba(255,255,255,.3)",margin:"0 2px"}}/>
        {/* Rotate */}
        <button onMouseDown={e=>e.preventDefault()} title="Rotate Left 90°" onClick={()=>{if(selectedShape){const r=(parseInt(selectedShape.dataset.rot||0)-90+360)%360;selectedShape.style.transform=`rotate(${r}deg)`;selectedShape.dataset.rot=r}}} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 7px",cursor:"pointer"}}>↺ 90°</button>
        <button onMouseDown={e=>e.preventDefault()} title="Rotate Right 90°" onClick={()=>{if(selectedShape){const r=(parseInt(selectedShape.dataset.rot||0)+90)%360;selectedShape.style.transform=`rotate(${r}deg)`;selectedShape.dataset.rot=r}}} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 7px",cursor:"pointer"}}>↻ 90°</button>
        <button onMouseDown={e=>e.preventDefault()} title="Flip Horizontal" onClick={()=>{if(selectedShape){const cur=selectedShape.style.transform||"";selectedShape.style.transform=cur.includes("scaleX(-1)")?cur.replace(" scaleX(-1)",""):cur+" scaleX(-1)"}}} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 7px",cursor:"pointer"}}>⇆ H</button>
        <button onMouseDown={e=>e.preventDefault()} title="Flip Vertical" onClick={()=>{if(selectedShape){const cur=selectedShape.style.transform||"";selectedShape.style.transform=cur.includes("scaleY(-1)")?cur.replace(" scaleY(-1)",""):cur+" scaleY(-1)"}}} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 7px",cursor:"pointer"}}>⇅ V</button>
        <div style={{width:1,height:20,background:"rgba(255,255,255,.3)",margin:"0 2px"}}/>
        {/* Fill color */}
        <span style={{fontSize:10,opacity:.7}}>Fill:</span>
        <input type="color" defaultValue={selectedShape.dataset.fill||"#dce6f5"}
          onChange={e=>{if(selectedShape)rebuildShapeSVG(selectedShape,e.target.value,null,null)}}
          style={{width:28,height:22,padding:1,border:"none",borderRadius:3,cursor:"pointer"}}/>
        {/* Stroke color */}
        <span style={{fontSize:10,opacity:.7}}>Border:</span>
        <input type="color" defaultValue={selectedShape.dataset.stroke||"#2b579a"}
          onChange={e=>{if(selectedShape)rebuildShapeSVG(selectedShape,null,e.target.value,null)}}
          style={{width:28,height:22,padding:1,border:"none",borderRadius:3,cursor:"pointer"}}/>
        {/* Stroke width */}
        <select defaultValue={selectedShape.dataset.sw||"2"}
          onChange={e=>{if(selectedShape)rebuildShapeSVG(selectedShape,null,null,parseInt(e.target.value))}}
          style={{padding:"2px 4px",borderRadius:3,border:"none",fontSize:11,background:"rgba(255,255,255,.15)",color:"#fff"}}>
          {[1,2,3,4,5].map(n=><option key={n} value={n} style={{color:"#000"}}>{n}px</option>)}
        </select>
        <div style={{width:1,height:20,background:"rgba(255,255,255,.3)",margin:"0 2px"}}/>
        {/* Opacity */}
        <span style={{fontSize:10,opacity:.7}}>Opacity:</span>
        <input type="range" min={10} max={100} defaultValue={Math.round((parseFloat(selectedShape.style.opacity||1))*100)}
          onChange={e=>{if(selectedShape)selectedShape.style.opacity=e.target.value/100}}
          style={{width:56}}/>
        {/* Shadow */}
        <select defaultValue="none"
          onChange={e=>applyObjectEffect(selectedShape,e.target.value)}
          style={{padding:"2px 4px",borderRadius:3,border:"none",fontSize:11,background:"rgba(255,255,255,.15)",color:"#fff"}}>
          <option value="none" style={{color:"#000"}}>No Effect</option>
          <option value="shadow" style={{color:"#000"}}>Shadow</option>
          <option value="glow" style={{color:"#000"}}>Glow</option>
          <option value="reflect" style={{color:"#000"}}>Reflect</option>
        </select>
        {false&&<>
        <div style={{width:1,height:20,background:"rgba(255,255,255,.3)",margin:"0 2px"}}/>
        {/* Z-order */}
        <button onMouseDown={e=>e.preventDefault()} title="Bring Forward" onClick={()=>{if(selectedShape){const z=parseInt(selectedShape.style.zIndex||0);selectedShape.style.zIndex=z+1}}} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:11}}>↑Fwd</button>
        <button onMouseDown={e=>e.preventDefault()} title="Send Backward" onClick={()=>{if(selectedShape){const z=parseInt(selectedShape.style.zIndex||0);selectedShape.style.zIndex=Math.max(0,z-1)}}} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:11}}>↓Bck</button>
        {/* Align */}
        <select defaultValue="" onChange={e=>{
          if(!selectedShape||!e.target.value)return
          let block=selectedShape.parentElement
          if(!block)return
          // Never set text-align directly on the page root — that would
          // misalign the whole document, not just this shape. If the shape
          // isn't already sitting in its own paragraph, give it one.
          if(block.hasAttribute&&block.hasAttribute("contenteditable")){
            const wrap=document.createElement("p")
            block.insertBefore(wrap,selectedShape)
            wrap.appendChild(selectedShape)
            block=wrap
          }
          // Clear any leftover free-drag offset — otherwise it fights with
          // the alignment we're about to apply.
          selectedShape.style.marginLeft=""
          block.style.textAlign=e.target.value
          dirtyRef.current=true; saveHistory()
          e.target.value=""
        }} style={{padding:"2px 4px",borderRadius:3,border:"none",fontSize:11,background:"rgba(255,255,255,.15)",color:"#fff"}}>
          <option value="" style={{color:"#000"}}>Align…</option>
          <option value="left" style={{color:"#000"}}>⬅ Left</option>
          <option value="center" style={{color:"#000"}}>↔ Center</option>
          <option value="right" style={{color:"#000"}}>➡ Right</option>
        </select>
        </>}
        {/* Duplicate */}
        <button onMouseDown={e=>e.preventDefault()} title="Duplicate" onClick={()=>duplicateShape(selectedShape)} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:11}}>⧉ Copy</button>
        {/* Delete */}
        <button onMouseDown={e=>e.preventDefault()} title="Delete" onClick={deleteSelectedShape} style={{background:"#c0392b",border:"none",color:"#fff",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:13,fontWeight:700}}>🗑</button>
        {/* Close toolbar without deleting the object */}
        <button onMouseDown={e=>e.preventDefault()} title="Close toolbar"
          onClick={()=>{document.querySelectorAll("[data-shape],[data-chart]").forEach(shape=>{const indicator=shape.querySelector(".shape-sel-indicator");if(indicator)indicator.style.display="none";shape.querySelectorAll(".shape-handle").forEach(handle=>handle.remove())});setSelectedShape(null);setContextMenu(null)}}
          style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:15,fontWeight:700,lineHeight:1}}>×</button>
        </>}
      </div>,document.body
    )}

    {/* ✅ CONTEXT MENU — right-click on shape */}
    {contextMenu&&createPortal(
      <div id="shape-ctx-menu" style={{position:"fixed",
        top:Math.max(8,Math.min(contextMenu.y,window.innerHeight-355)),
        left:Math.max(8,Math.min(contextMenu.x,window.innerWidth-226)),
        background:"#fff",border:`1px solid ${BORDER}`,borderRadius:8,
        boxShadow:"0 10px 32px rgba(0,0,0,.26)",zIndex:99998,width:218,
        maxHeight:"calc(100vh - 16px)",overflowY:"auto",padding:"5px 0",fontSize:13}}>
        {[
          {label:"✂ Cut",          fn:()=>{navigator.clipboard?.writeText(contextMenu.el.outerHTML);contextMenu.el.remove();setSelectedShape(null);setContextMenu(null)}},
          {label:"⎘ Copy",         fn:()=>{navigator.clipboard?.writeText(contextMenu.el.outerHTML);setContextMenu(null)}},
          {label:"⧉ Duplicate",    fn:()=>duplicateShape(contextMenu.el)},
          {label:"divider"},
          ...(contextMenu.el.hasAttribute("data-chart")?[
            {label:"📊 Edit Chart Data…",fn:()=>openExistingChartEditor(contextMenu.el)},
            {label:"✏ Rename Chart…",fn:()=>openExistingChartEditor(contextMenu.el)},
            {label:"▥ Change Chart Type…",fn:()=>openExistingChartEditor(contextMenu.el)},
            {label:"↔ Reset Chart Size",fn:()=>{contextMenu.el.style.width="380px";contextMenu.el.style.height="260px";setContextMenu(null);dirtyRef.current=true}},
          ]:contextMenu.el.dataset.shape==="image"?[
            {label:"🖼 Edit Picture…",fn:()=>editExistingImage(contextMenu.el)},
            {label:"✂ Crop Picture…",fn:()=>editExistingImage(contextMenu.el)},
          ]:[{label:"✏ Edit Text",fn:()=>{const td=contextMenu.el.querySelector(".shape-text");if(td){td.style.pointerEvents="all";td.contentEditable="true";td.style.outline="1px dashed rgba(43,87,154,.5)";td.focus()};setContextMenu(null)}}]),
          {label:"divider"},
          ...(contextMenu.el.dataset.shape==="image"||contextMenu.el.hasAttribute("data-chart")?[]:[
            {label:"◻ Remove Shape Fill",fn:()=>{rebuildShapeSVG(contextMenu.el,"transparent",null,null);setContextMenu(null)}},
            {label:"↔ Reset Shape Size",fn:()=>{const el=contextMenu.el,type=el.dataset.shape;const wide=["arrow","doublearrow","leftarrow","chevron","notchedarrow","banner","ribbon","cloud","oval","roundedrect","parallelogram","trapezoid","plaque","wave"].includes(type);el.style.width=(wide?160:120)+"px";el.style.height=(["line","curved"].includes(type)?24:wide?80:100)+"px";setContextMenu(null);dirtyRef.current=true}},
            {label:"divider"},
          ]),
          {label:"🗑 Delete",       fn:()=>deleteSelectedShape()},
        ].map((item,i)=>item.label==="divider"
          ?<div key={i} style={{height:1,background:"#eee",margin:"3px 0"}}/>
          :<button key={item.label} onClick={item.fn}
            onMouseEnter={e=>e.currentTarget.style.background="#e3edf7"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            style={{display:"block",width:"100%",padding:"7px 16px",border:"none",background:"transparent",cursor:"pointer",textAlign:"left",color:"#1a1a1a",fontSize:13}}>
            {item.label}
          </button>
        )}
      </div>,document.body
    )}

    {linkContext&&createPortal(
      <div id="link-context-menu" style={{position:"fixed",
        top:Math.max(8,Math.min(linkContext.y,window.innerHeight-145)),
        left:Math.max(8,Math.min(linkContext.x,window.innerWidth-205)),
        width:195,background:"#fff",border:`1px solid ${BORDER}`,borderRadius:7,
        boxShadow:"0 8px 24px rgba(0,0,0,.22)",zIndex:99999,padding:"4px 0",fontSize:12}}>
        {[
          ["↗ Open Link",()=>{window.open(linkContext.element.href,"_blank","noopener,noreferrer");setLinkContext(null)}],
          ["✏ Edit Address…",()=>{const link=linkContext.element;setLinkContext(null);showModal({type:"prompt",title:"Edit Link",message:"Enter the new address:",inputDefault:link.getAttribute("href")||"",onConfirm:value=>{let address=(value||"").trim();if(address&&!/^(https?:|mailto:|tel:|#)/i.test(address))address=`https://${address}`;if(address){saveHistory();link.href=address;link.title=address;dirtyRef.current=true}closeModal()}})}],
          ["⛓ Remove Link",()=>{const link=linkContext.element;saveHistory();const parent=link.parentNode;while(link.firstChild)parent.insertBefore(link.firstChild,link);link.remove();setLinkContext(null);dirtyRef.current=true}],
        ].map(([label,action])=><button key={label} onClick={action}
          style={{display:"block",width:"100%",padding:"7px 12px",border:"none",background:"#fff",textAlign:"left",cursor:"pointer",fontSize:12}}
          onMouseEnter={event=>event.currentTarget.style.background="#e8f0fa"}
          onMouseLeave={event=>event.currentTarget.style.background="#fff"}>{label}</button>)}
      </div>,document.body
    )}

    {/* DIALOGS */}
    {/* Feature 1: Live Chart Editor */}
    {showChartEditor&&<ChartEditorDialog key={chartEditorTarget?.element?.id||"new-chart"}
      initialData={chartEditorTarget?.meta||null}
      onInsert={chartEditorTarget?updateLiveChart:insertLiveChart}
      onClose={()=>{setShowChartEditor(false);setChartEditorTarget(null)}}/>}
    {/* Feature 2: Table of Contents */}
    {showTOC&&<TableOfContents pagesRef={pagesRef} onClose={()=>setShowTOC(false)} onInsert={insertTOC}/>}
    {/* Feature 4: Image Editor */}
    {showImageEditor&&<ImageEditorDialog src={imageEditorSrc} onSave={(styleStr)=>{if(imageEditorCallback)imageEditorCallback(imageEditorSrc,styleStr)}} onClose={()=>setShowImageEditor(false)}/>}
    {showTable&&<TableDialog onInsert={insertTable} onClose={()=>setShowTable(false)}/>}
    {showImage&&<ImageDialog onInsert={insertImage} onClose={()=>setShowImage(false)} onEditImage={(src,w,align)=>{setShowImage(false);openImageEditor(src,style=>insertStyledImage(src,w,align,style))}}/>}
    {showLink&&<LinkDialog selectedText={linkSelectedText} onInsert={applyLink} onClose={()=>setShowLink(false)}/>}
    {showOpen&&<OpenDialog onOpen={openDoc} onClose={()=>setShowOpen(false)} token={token}/>}
    {shareInfo&&<ShareDialog title={shareInfo.title} url={shareInfo.url}
      onClose={()=>setShareInfo(null)} onStop={stopSharing} dark={dark}/>}
    {/* Cover Page Dialog */}
    {showCoverPage&&<CoverPageDialog onInsert={insertCoverPageHTML} onClose={()=>setShowCoverPage(false)}/>}
    {/* Text Box Dialog */}
    {showTextBoxDlg&&<TextBoxDialog onInsert={insertTextBox} onClose={()=>setShowTextBoxDlg(false)}/>}
    {/* WordArt Dialog */}

    {modal&&<AppModal {...modal} onClose={closeModal} dark={dark}>{modal.extra}</AppModal>}
    {toast&&<Toast msg={toast.msg} type={toast.type}/>}

    {/* KASHMIRI ON-SCREEN KEYBOARD */}
    {kbOpen&&(()=>{
      const KB_ROWS=[
        [{code:"Backquote",main:"ٲ",shift:"ؠ",special:false},{code:"Digit1",main:"۱",shift:"!",special:false},{code:"Digit2",main:"۲",shift:"@",special:false},{code:"Digit3",main:"۳",shift:"#",special:false},{code:"Digit4",main:"۴",shift:"$",special:false},{code:"Digit5",main:"۵",shift:"٪",special:false},{code:"Digit6",main:"۶",shift:"^",special:false},{code:"Digit7",main:"۷",shift:"&",special:false},{code:"Digit8",main:"۸",shift:"*",special:false},{code:"Digit9",main:"۹",shift:"(",special:false},{code:"Digit0",main:"۰",shift:")",special:false},{code:"Minus",main:"-",shift:"_",special:false},{code:"Equal",main:"=",shift:"+",special:false},{code:"Backspace",main:"⌫",shift:null,special:true}],
        [{code:"Tab",main:"Tab",shift:null,special:true},{code:"KeyQ",main:"ق",shift:"ص",special:false},{code:"KeyW",main:"و",shift:"ۄ",special:false},{code:"KeyE",main:"ع",shift:"ء",special:false},{code:"KeyR",main:"ر",shift:"ڑ",special:false},{code:"KeyT",main:"ت",shift:"ٹ",special:false},{code:"KeyY",main:"ی",shift:"ے",special:false},{code:"KeyU",main:"و",shift:"ٗ",special:false},{code:"KeyI",main:"ی",shift:"ِ",special:false},{code:"KeyO",main:"وٚ",shift:"ٚ",special:false},{code:"KeyP",main:"پ",shift:"ٟ",special:false},{code:"BracketLeft",main:"]",shift:"{",special:false},{code:"BracketRight",main:"[",shift:"}",special:false},{code:"Backslash",main:"\\",shift:"|",special:false}],
        [{code:"CapsLock",main:"Caps",shift:null,special:true},{code:"KeyA",main:"ا",shift:"آ",special:false},{code:"KeyS",main:"س",shift:"ش",special:false},{code:"KeyD",main:"د",shift:"ڈ",special:false},{code:"KeyF",main:"ف",shift:"ث",special:false},{code:"KeyG",main:"گ",shift:"غ",special:false},{code:"KeyH",main:"ہ",shift:"ح",special:false},{code:"KeyJ",main:"ج",shift:"ض",special:false},{code:"KeyK",main:"ک",shift:"خ",special:false},{code:"KeyL",main:"ل",shift:"ط",special:false},{code:"Semicolon",main:"؛",shift:":",special:false},{code:"Quote",main:"ٔ",shift:"ٕ",special:false},{code:"Enter",main:"↵",shift:null,special:true}],
        [{code:"ShiftLeft",main:"⇧",shift:null,special:true},{code:"KeyZ",main:"ز",shift:"ژ",special:false},{code:"KeyX",main:"خ",shift:"ذ",special:false},{code:"KeyC",main:"چ",shift:"چھ",special:false},{code:"KeyV",main:"و",shift:"ظ",special:false},{code:"KeyB",main:"ب",shift:"بھ",special:false},{code:"KeyN",main:"ن",shift:"ں",special:false},{code:"KeyM",main:"م",shift:"مّ",special:false},{code:"Comma",main:"،",shift:"<",special:false},{code:"Period",main:"۔",shift:">",special:false},{code:"Slash",main:"؟",shift:"؟",special:false},{code:"ShiftRight",main:"⇧",shift:null,special:true}],
        [{code:"ControlLeft",main:"Ctrl",shift:null,special:true},{code:"AltLeft",main:"Alt",shift:null,special:true},{code:"Space",main:" ",shift:" ",special:true},{code:"AltRight",main:"Alt",shift:null,special:true},{code:"ControlRight",main:"Ctrl",shift:null,special:true}],
      ]
      function restoreKeyboardCaret(pg){
        const saved=savedRangeRef.current?.cloneRange()
        pg.focus({preventScroll:true})
        const selection=window.getSelection()
        if(!selection)return null
        if(saved?.startContainer?.isConnected&&pg.contains(saved.startContainer)
          &&pg.contains(saved.endContainer)){
          selection.removeAllRanges();selection.addRange(saved)
        }else if(!pg.contains(selection.anchorNode)){
          const range=document.createRange()
          range.selectNodeContents(pg);range.collapse(false)
          selection.removeAllRanges();selection.addRange(range)
        }
        return selection
      }
      function insertKbChar(ch){
        const pg=activePgRef.current||pagesRef.current[0];if(!pg)return
        const selection=restoreKeyboardCaret(pg);if(!selection)return
        if(!insertTrackedCommandText(ch))document.execCommand("insertText",false,ch)
        if(selection.rangeCount)savedRangeRef.current=selection.getRangeAt(0).cloneRange()
        activePgRef.current=pg;dirtyRef.current=true;updateStats()
        requestAnimationFrame(()=>spillCheck())
        if(kbShift&&!kbCaps)setKbShift(false)
      }
      function handleSpecialKey(code){const pg=activePgRef.current||pagesRef.current[0];if(!pg)return;switch(code){case"Backspace":{restoreKeyboardCaret(pg);const keyEvent=new KeyboardEvent("keydown",{key:"Backspace",code:"Backspace",bubbles:true,cancelable:true});if(pg.dispatchEvent(keyEvent)){if(!deleteTrackedCommand("backward"))document.execCommand("delete",false);dirtyRef.current=true;updateStats()}break}case"Enter":restoreKeyboardCaret(pg);saveHistory();if(trackChanges){insertTrackedParagraph(pg);scheduleTrackedHistory()}else insertDocumentParagraph(pg);dirtyRef.current=true;updateStats();requestAnimationFrame(()=>spillCheck());break;case"Tab":insertKbChar("\u0009");break;case"CapsLock":setKbCaps(v=>!v);break;case"ShiftLeft":case"ShiftRight":setKbShift(v=>!v);break;case"Space":restoreKeyboardCaret(pg);if(!insertTrackedCommandText(" "))document.execCommand("insertText",false," ");dirtyRef.current=true;break;default:break}}
      function onDragStart(e){e.preventDefault();const startX=e.clientX,startY=e.clientY,origX=kbPos.x,origY=kbPos.y??(window.innerHeight-kbH-40);function onMove(ev){setKbPos({x:Math.max(0,origX+ev.clientX-startX),y:Math.max(0,origY+ev.clientY-startY)})};function onUp(){window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp)};window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp)}
      function onResizeStart(e){e.preventDefault();e.stopPropagation();const startX=e.clientX,startY=e.clientY,origW=kbW,origH=kbH;function onMove(ev){setKbW(Math.max(380,origW+ev.clientX-startX));setKbH(Math.max(220,origH+ev.clientY-startY))};function onUp(){window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp)};window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp)}
      const isUpper=kbShift!==kbCaps
      const keyCaption=code=>{
        if(code.startsWith("Key"))return code.slice(3).toLowerCase()
        if(code.startsWith("Digit"))return code.slice(5)
        return {Backquote:"`",Minus:"-",Equal:"=",BracketLeft:"[",BracketRight:"]",
          Backslash:"\\",Semicolon:";",Quote:"'",Comma:",",Period:".",Slash:"/"}[code]||""
      }
      const keyFlex={Backspace:1.8,Tab:1.4,CapsLock:1.8,Enter:2.0,ShiftLeft:2.2,ShiftRight:2.2,Space:6,ControlLeft:1.4,ControlRight:1.4,AltLeft:1.2,AltRight:1.2}
      const specialBg=(code,active)=>{if(code==="Backspace")return"#c0392b";if(code==="Enter")return"#1a7f4e";if(code==="CapsLock")return active?"#d97706":"#6c757d";if(code==="ShiftLeft"||code==="ShiftRight")return active?"#1a7f4e":"#495057";return"#495057"}
      const posY=kbPos.y??(window.innerHeight-kbH-44)
      return(<div style={{position:"fixed",left:kbPos.x,top:posY,width:kbW,height:kbH+36,zIndex:99998,display:"flex",flexDirection:"column",boxShadow:"0 8px 40px rgba(0,0,0,.4)",borderRadius:10,overflow:"hidden",border:"1px solid rgba(43,87,154,.5)"}}>
        <div onMouseDown={onDragStart} style={{background:"#1e3f6f",color:"#fff",height:36,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",cursor:"grab",userSelect:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,minWidth:0}}>
            <span>⌨</span><span>کشمیری کی بورڈ</span>
            {kbShift&&<span style={{fontSize:10,background:"#1a7f4e",padding:"1px 7px",borderRadius:3,fontWeight:700}}>SHIFT</span>}
            {kbCaps&&<span style={{fontSize:10,background:"#d97706",padding:"1px 7px",borderRadius:3,fontWeight:700}}>CAPS</span>}
          </div>
          <div style={{display:"flex",gap:3,marginLeft:"auto",marginRight:8}}>
            {[["phonetic","Phonetic"],["alphabet","Alphabet"],["vowels","Vowels & Marks"]].map(([view,label])=>(
              <button key={view} onMouseDown={e=>{e.preventDefault();e.stopPropagation()}} onClick={()=>setKbView(view)}
                style={{border:"1px solid rgba(255,255,255,.25)",borderRadius:4,padding:"3px 7px",
                  background:kbView===view?"#fff":"rgba(255,255,255,.12)",
                  color:kbView===view?"#1e3f6f":"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                {label}
              </button>
            ))}
          </div>
          <button onMouseDown={e=>e.stopPropagation()} onClick={()=>setKbOpen(false)} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:4,width:24,height:24,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{flex:1,background:"#2c3e50",padding:"8px 10px",display:"flex",flexDirection:"column",gap:5,overflowY:"auto"}}>
          {kbView==="phonetic"&&<div style={{flexShrink:0,color:"rgba(255,255,255,.78)",
            fontFamily:"Segoe UI,sans-serif",fontSize:9,textAlign:"center"}}>
            m → م &nbsp; b → ب &nbsp; n → ن &nbsp; sh → ش &nbsp; bh → بھ &nbsp;
            kH → کھ &nbsp; ae → ٲ
          </div>}
          {kbView==="phonetic"?KB_ROWS.map((row,ri)=>(<div key={ri} style={{display:"flex",gap:4,flex:1,minHeight:0}}>
            {row.map((key)=>{
              const isActive=(key.code==="CapsLock"&&kbCaps)||((key.code==="ShiftLeft"||key.code==="ShiftRight")&&kbShift)
              const flex=keyFlex[key.code]||1
              const displayChar=key.special?key.main:(isUpper&&key.shift?key.shift:key.main)
              const bg=key.special?specialBg(key.code,isActive):"#2b579a"
              const isModifier=["ControlLeft","ControlRight","AltLeft","AltRight","MetaLeft","MetaRight"].includes(key.code)
              return(<button key={key.code} onMouseDown={e=>e.preventDefault()} onClick={()=>key.special?handleSpecialKey(key.code):insertKbChar(displayChar)}
                style={{position:"relative",flex,minWidth:0,height:"100%",background:isActive?specialBg(key.code,true):bg,color:isModifier?"rgba(255,255,255,.6)":"#fff",border:"1px solid rgba(255,255,255,.12)",borderBottom:"2px solid rgba(0,0,0,.3)",borderRadius:5,cursor:"pointer",fontFamily:key.special?"Segoe UI,sans-serif":"Noto Nastaliq Kashur,Arial,serif",fontSize:key.special?Math.max(10,kbW/60):Math.max(12,kbW/52),fontWeight:key.special?500:400,display:"flex",alignItems:"center",justifyContent:"center",userSelect:"none",opacity:isModifier?.7:1}}
                onMouseEnter={e=>{if(!isModifier)e.currentTarget.style.background="#1a3a6c";e.currentTarget.style.transform="translateY(-1px)"}}
                onMouseLeave={e=>{e.currentTarget.style.background=isActive?specialBg(key.code,true):bg;e.currentTarget.style.transform="none"}}>
                {!key.special&&<span style={{position:"absolute",top:2,left:4,fontFamily:"Segoe UI,sans-serif",
                  fontSize:8,opacity:.65,fontWeight:700}}>{keyCaption(key.code)}</span>}
                {!key.special&&key.shift&&key.shift!==key.main?(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0,lineHeight:1}}>
                    <span style={{fontSize:"0.65em",opacity:.7,lineHeight:1}}>{key.shift}</span>
                    <span style={{lineHeight:1}}>{key.main}</span>
                  </div>
                ):displayChar}
              </button>)
            })}
          </div>)):(
            <div style={{display:"flex",flexDirection:"column",gap:7,padding:2}}>
              {KASHMIRI_KEYBOARD_GROUPS[kbView].map(group=>(
                <div key={group.label}>
                  <div style={{color:"rgba(255,255,255,.72)",fontSize:10,fontWeight:700,
                    margin:"0 0 4px 2px",fontFamily:"Segoe UI,sans-serif"}}>{group.label}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(42px,1fr))",gap:4}}>
                    {group.keys.map((entry,index)=>{
                      const item=typeof entry==="string"?{value:entry}:entry
                      return <button key={`${group.label}-${index}`} onMouseDown={e=>e.preventDefault()}
                        onClick={()=>insertKbChar(item.value)} title={item.hint||item.value}
                        style={{minHeight:43,background:"#2b579a",color:"#fff",
                          border:"1px solid rgba(255,255,255,.14)",borderBottom:"2px solid rgba(0,0,0,.3)",
                          borderRadius:5,cursor:"pointer",fontFamily:"Noto Nastaliq Kashur,Arial,serif",
                          fontSize:16,display:"flex",flexDirection:"column",alignItems:"center",
                          justifyContent:"center",lineHeight:1.05,padding:"3px 2px"}}>
                        <span>{item.display||item.value}</span>
                        {item.hint&&<span style={{fontFamily:"Segoe UI,sans-serif",fontSize:8,
                          opacity:.7,marginTop:2}}>{item.hint}</span>}
                      </button>
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div onMouseDown={onResizeStart} style={{position:"absolute",bottom:0,right:0,width:20,height:20,cursor:"nwse-resize",background:"linear-gradient(135deg, transparent 50%, #1e3f6f 50%)",borderRadius:"0 0 10px 0"}}/>
      </div>)
    })()}

  </div>)
}
