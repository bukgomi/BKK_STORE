"use client";
/**
 * 상품 상세설명 편집기 — "직접 작성"(위지윅) / "HTML 작성" 두 탭
 * - 두 탭은 같은 HTML 문자열(value)을 공유한다. 어느 쪽에서 고쳐도 다른 탭에 반영
 * - 사진은 /api/admin/upload 로 올라가고 본문에 <img> 로 삽입 (드래그앤드롭·붙여넣기 지원)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

type Tab = "wysiwyg" | "html";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "업로드 실패");
  // 상세페이지는 큰 사이즈 우선
  return data.largeUrl || data.url;
}

function looksLikeHtml(s: string) {
  return /<\s*[a-z][\s\S]*?>/i.test(s);
}
function textToHtml(text: string) {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export default function RichDescriptionEditor({ value, onChange, placeholder }: Props) {
  const [tab, setTab] = useState<Tab>("wysiwyg");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // 편집기가 낸 마지막 HTML — 외부 value 와 같으면 setContent 를 다시 하지 않도록
  const lastEmitted = useRef<string>("");

  const editor = useEditor({
    immediatelyRender: false, // Next.js SSR 에서 hydration 불일치 방지
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "detail-img" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value ? (looksLikeHtml(value) ? value : textToHtml(value)) : "",
    editorProps: {
      attributes: { class: "detail-editor min-h-[360px] px-4 py-3 outline-none" },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || !files.length) return false;
        const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (!imgs.length) return false;
        event.preventDefault();
        void insertFiles(imgs);
        return true;
      },
      handlePaste: (view, event) => {
        const files = event.clipboardData?.files;
        if (!files || !files.length) return false;
        const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (!imgs.length) return false;
        event.preventDefault();
        void insertFiles(imgs);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // HTML 탭에서 고친 내용 → 위지윅에 반영
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    const html = value ? (looksLikeHtml(value) ? value : textToHtml(value)) : "";
    editor.commands.setContent(html, false);
    lastEmitted.current = value;
  }, [value, editor]);

  const insertFiles = useCallback(async (files: File[]) => {
    if (!editor) return;
    setUploading(true); setErr("");
    try {
      for (const f of files) {
        const url = await uploadImage(f);
        editor.chain().focus().setImage({ src: url, alt: f.name.replace(/\.[^.]+$/, "") }).run();
      }
    } catch (e: any) {
      setErr(e.message || "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  }, [editor]);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 주소", prev || "https://");
    if (url === null) return;
    if (!url.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const btn = (active: boolean) =>
    `px-2 h-8 min-w-[32px] rounded text-sm border transition-colors ${active ? "bg-brand-600 text-white border-brand-600" : "bg-white border-gray-200 hover:border-brand-400 text-gray-700"}`;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* 탭 */}
      <div className="flex border-b border-gray-200 bg-gray-50 text-sm">
        {([["wysiwyg", "직접 작성"], ["html", "HTML 작성"]] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k} type="button" onClick={() => setTab(k)}
            className={`px-5 h-10 font-medium border-b-2 -mb-px ${tab === k ? "border-brand-600 text-brand-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-3 text-xs text-gray-400">
          {uploading ? "이미지 업로드 중..." : "사진은 드래그하거나 붙여넣어도 올라갑니다"}
        </div>
      </div>

      {tab === "wysiwyg" && editor && (
        <>
          {/* 툴바 */}
          <div className="flex flex-wrap items-center gap-1 px-2 py-2 border-b border-gray-100">
            <select
              className="h-8 border border-gray-200 rounded text-sm px-1"
              value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "p") editor.chain().focus().setParagraph().run();
                else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
              }}
            >
              <option value="p">본문</option>
              <option value="h1">제목 1</option>
              <option value="h2">제목 2</option>
              <option value="h3">제목 3</option>
            </select>
            <span className="w-px h-6 bg-gray-200 mx-1" />
            <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게"><b>B</b></button>
            <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임"><i>I</i></button>
            <button type="button" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="밑줄"><u>U</u></button>
            <button type="button" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()} title="취소선"><s>S</s></button>
            <span className="w-px h-6 bg-gray-200 mx-1" />
            <button type="button" className={btn(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="왼쪽 정렬">≡</button>
            <button type="button" className={btn(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="가운데 정렬">☰</button>
            <button type="button" className={btn(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="오른쪽 정렬">≡</button>
            <span className="w-px h-6 bg-gray-200 mx-1" />
            <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="글머리 기호">• 목록</button>
            <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호 목록">1. 목록</button>
            <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="인용구">&ldquo; 인용</button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선">— 구분선</button>
            <span className="w-px h-6 bg-gray-200 mx-1" />
            <button type="button" className={btn(editor.isActive("link"))} onClick={setLink} title="링크">🔗 링크</button>
            <button type="button" className={btn(false)} onClick={() => fileRef.current?.click()} disabled={uploading} title="사진 삽입">
              {uploading ? "업로드 중..." : "🖼 사진"}
            </button>
            <input
              ref={fileRef} type="file" accept="image/*" multiple hidden
              onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) void insertFiles(fs); }}
            />
            <span className="ml-auto flex gap-1">
              <button type="button" className={btn(false)} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="실행 취소">↶</button>
              <button type="button" className={btn(false)} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="다시 실행">↷</button>
            </span>
          </div>
          <div className="relative">
            {editor.isEmpty && (
              <div className="pointer-events-none absolute left-4 top-3 text-sm text-gray-400">{placeholder || "내용을 입력하세요. 사진을 끌어다 놓으면 바로 올라갑니다."}</div>
            )}
            <EditorContent editor={editor} />
          </div>
        </>
      )}

      {tab === "html" && (
        <textarea
          className="w-full min-h-[420px] px-4 py-3 font-mono text-xs outline-none resize-y"
          value={value}
          onChange={(e) => { lastEmitted.current = ""; onChange(e.target.value); }}
          placeholder={"<p>HTML 을 직접 붙여 넣으세요.</p>\n<img src=\"/uploads/products/xxx.jpg\" alt=\"\">\n스크립트·외부 폼은 저장 시 제거됩니다."}
          spellCheck={false}
        />
      )}

      {err && <div className="px-4 py-2 text-xs text-red-600 border-t border-red-100 bg-red-50">{err}</div>}
    </div>
  );
}
