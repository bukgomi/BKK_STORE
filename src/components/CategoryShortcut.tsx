import Link from "next/link";
import { emojiFor } from "@/lib/category-icons";

type Category = { id: string; name: string; slug: string; emoji?: string; iconEmoji?: string | null };

export default function CategoryShortcut({ categories }: { categories: Category[] }) {
  return (
    <section>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/category/${c.slug}`}
            className="group flex flex-col items-center gap-2 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-50 group-hover:bg-brand-100 flex items-center justify-center text-2xl transition-colors">
              {emojiFor(c.slug, c.iconEmoji || c.emoji)}
            </div>
            <span className="text-xs sm:text-sm text-gray-700 group-hover:text-brand-600 font-medium">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
