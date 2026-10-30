import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ShoppingBag, Shirt, TrendingUp, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { fetchProducts, isFabricProduct, type ShopifyProduct } from "@/lib/shopify";
import { StockNotification } from "@/components/StockNotification";
import { useRouter } from "@tanstack/react-router";
import { useCartStore } from "@/stores/cartStore";

const productsQuery = queryOptions({
  queryKey: ["shopify-products"],
  queryFn: fetchProducts,
});

export const Route = createFileRoute("/shop")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  head: () => ({
    meta: [
      { title: "Shop outfits and fabric | Fashley" },
      { name: "description", content: "Shop ready-made outfits and fabric by the metre. Browse Ankara and kente styles for your next visit to the tailor." },
      { property: "og:title", content: "Shop outfits and fabric | Fashley" },
      { property: "og:description", content: "Shop ready-made outfits and fabric by the metre. Browse Ankara and kente styles for your next visit to the tailor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({reset}) => { const router = useRouter(); return <div><SiteHeader/><main className="mx-auto max-w-6xl px-5 py-12"><h1 className="text-4xl">The shop couldn’t load</h1><p className="mt-4">Please try again in a moment.</p><Button className="mt-6" onClick={() => {router.invalidate();reset();}}>Try again</Button></main></div>; },
  notFoundComponent: () => <div><SiteHeader/><main className="px-5 py-12">We can’t find this collection.</main></div>,
  pendingComponent: () => <div><SiteHeader/><main className="px-5 py-12" role="status">Loading the Fashley shop…</main></div>,
  component: Shop,
});

const pin = (q: string) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;


const trending = [
  { name: "Kaba & slit", q: "kaba and slit styles Ghana" },
  { name: "Kente wedding looks", q: "kente wedding dress" },
  { name: "Bubu kaftans", q: "bubu kaftan dress" },
  { name: "Fugu & smocks", q: "fugu smock styles Ghana" },
  { name: "Ankara corset gowns", q: "ankara corset gown" },
  { name: "Senator wear", q: "senator native wear men" },
];

function ProductCard({ product }: { product: ShopifyProduct }) {
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const node = product.node;
  const variant = node.variants.edges[0]?.node;
  const image = node.images.edges[0]?.node;

  const handleAdd = async () => {
    if (!variant) return;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });
    toast.success(`${node.title} added to cart`);
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Link to="/product/$handle" params={{ handle: node.handle }} className="block">
        <div className="aspect-square overflow-hidden bg-secondary/20">
          {image ? (
            <img src={image.url} alt={image.altText ?? node.title} className="h-full w-full object-cover transition group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ShoppingBag className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="p-4 pb-2">
          <h3 className="font-medium leading-snug">{node.title}</h3>
          <p className="mt-1 text-sm font-semibold">
            {node.priceRange.minVariantPrice.currencyCode} {parseFloat(node.priceRange.minVariantPrice.amount).toFixed(2)}
          </p>
        </div>
      </Link>
      <div className="mt-auto p-4 pt-2">
        <Button onClick={handleAdd} disabled={isLoading || !variant?.availableForSale} className="w-full" size="sm">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : variant?.availableForSale ? "Add to cart" : "Sold out"}
        </Button>
      </div>
    </div>
  );
}

function ProductGrid({ products, section }: { products: ShopifyProduct[]; section: "outfits" | "fabric" }) {
  if (products.length === 0) {
    return <StockNotification section={section} />;
  }
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.node.id} product={p} />
      ))}
    </div>
  );
}

function Shop() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const fabrics = products.filter(isFabricProduct);
  const outfits = products.filter((p) => !isFabricProduct(p));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <BackButton fallback="/" label="Back" className="mb-8" />
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Shop</p>
        <h1 className="mt-3 text-5xl">The Fashley shop</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Find a ready-made outfit or fabric for your tailor. Browse styles while you choose.
        </p>

        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-3xl">
            <Shirt className="h-5 w-5" /> Ready-made outfits
          </h2>
          <ProductGrid products={outfits} section="outfits" />
        </section>

        <section className="mt-16">
          <h2 className="flex items-center gap-2 text-3xl">
            <ShoppingBag className="h-5 w-5" /> Buy fabric
          </h2>
          <ProductGrid products={fabrics} section="fabric" />
        </section>

        <section className="mt-16">
          <h2 className="flex items-center gap-2 text-3xl">
            <TrendingUp className="h-5 w-5" /> Trending styles
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Find a cut you like. Try it in the Studio or look for a similar outfit in the shop.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {trending.map((t) => (
              <a
                key={t.q}
                href={pin(t.q)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {t.name} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
            <Link to="/discover" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent">
              All trending styles <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
