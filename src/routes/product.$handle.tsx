import { createFileRoute, notFound, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { fetchProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";

const productQuery = (handle: string) =>
  queryOptions({
    queryKey: ["shopify-product", handle],
    queryFn: () => fetchProduct(handle),
  });

export const Route = createFileRoute("/product/$handle")({
  loader: async ({ context, params }) => {
    const product = await context.queryClient.ensureQueryData(productQuery(params.handle));
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.node.title ?? "Product"} | Fashley shop` },
      { name: "description", content: loaderData?.node.description?.slice(0, 160) || "View this item in the Fashley shop." },
      { property: "og:title", content: `${loaderData?.node.title ?? "Product"} | Fashley shop` },
      { property: "og:description", content: loaderData?.node.description?.slice(0, 160) || "View this item in the Fashley shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(loaderData?.node.images.edges[0]?.node.url.startsWith("https://") ? [
        { property: "og:image", content: loaderData.node.images.edges[0].node.url },
        { name: "twitter:image", content: loaderData.node.images.edges[0].node.url },
      ] : []),
    ],
  }),
  errorComponent: ({reset}) => { const router=useRouter(); return <div><SiteHeader/><main className="mx-auto max-w-6xl px-5 py-12"><h1 className="text-4xl">This product couldn’t load</h1><Button className="mt-6" onClick={()=>{router.invalidate();reset();}}>Try again</Button></main></div>; },
  notFoundComponent: () => <div><SiteHeader/><main className="mx-auto max-w-6xl px-5 py-12"><h1 className="text-4xl">This product isn’t available</h1><Button asChild className="mt-6"><Link to="/shop">Continue shopping</Link></Button></main></div>,
  component: ProductPage,
});

function ProductPage() {
  const { handle } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQuery(handle));
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const [variantId, setVariantId] = useState<string | null>(null);

  if (!product) return null;
  const node = product.node;
  const variants = node.variants.edges.map((e) => e.node);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
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
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <BackButton fallback="/shop" label="Back" className="mb-8" />
        <div className="grid gap-10 md:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-2xl bg-secondary/20">
            {image ? (
              <img src={image.url} alt={image.altText ?? node.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ShoppingBag className="h-16 w-16" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-4xl">{node.title}</h1>
            <p className="mt-3 text-2xl font-semibold">
              {variant?.price.currencyCode} {variant ? parseFloat(variant.price.amount).toFixed(2) : ""}
            </p>
            {variants.length > 1 && (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{node.options[0]?.name ?? "Options"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVariantId(v.id)}
                      className={`rounded-full border px-4 py-2 text-sm ${v.id === variant?.id ? "border-foreground bg-accent" : "border-border"}`}
                    >
                      {v.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {node.description && <p className="mt-6 whitespace-pre-line text-muted-foreground">{node.description}</p>}
            <Button onClick={handleAdd} disabled={isLoading || !variant?.availableForSale} className="mt-8 w-full md:w-auto" size="lg">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : variant?.availableForSale ? "Add to cart" : "Sold out"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
