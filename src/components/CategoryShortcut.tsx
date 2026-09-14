import Link from "next/link";
import CategoryIcon from "@/components/CategoryIcon";

type Category = { id: string; name: string; slug: string; emoji?: string; iconEmoji?: string | null; href?: string };

export default function CategoryShortcut({ categories }: { categories: Category[] }) {
  return (
    <section>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={c.href || `/category/${c.slug}`}
            className="group flex flex-col items-center gap-2 py-3 w-[calc(25%-0.5rem)] sm:w-[calc(16.666%-0.75rem)] lg:w-[calc(12.5%-0.75rem)] rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white flex items-center justify-center transition-colors">
              <CategoryIcon slug={c.slug} iconEmoji={c.iconEmoji || c.emoji} className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span className="text-xs sm:text-sm text-gray-700 group-hover:text-brand-600 font-medium">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
