import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card.tsx";
import { cn } from "@/lib/utils.ts";
import DrugImage from "./drug-image.tsx";

export type GallerySlide = { url: string; caption: string };

type Props = {
  url: string | null | undefined;
  alt: string;
  className?: string;
  // Pictures to flick through once enlarged; defaults to just this picture
  slides?: GallerySlide[];
  startIndex?: number;
  // Optional button shown in the large view (e.g. "Use this package form"); closes the view when pressed
  action?: { label: string; onClick: () => void };
  // Show a large preview after a short hover (mouse only; touch still taps to open)
  hoverPreview?: boolean;
};

const HOVER_DELAY_MS = 500;

// Picture thumbnail that opens a swipeable large view when pressed
export default function ZoomableDrugImage({
  url,
  alt,
  className,
  slides,
  startIndex = 0,
  action,
  hoverPreview = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const gallery = slides ?? (url ? [{ url, caption: alt }] : []);
  if (gallery.length === 0)
    return (
      <DrugImage url={null} alt={alt} className={cn("shrink-0", className)} />
    );

  const thumbnail = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "group relative shrink-0 cursor-zoom-in overflow-hidden rounded-lg",
        className,
      )}
      aria-label={`Enlarge picture of ${alt}`}
    >
      <DrugImage
        url={url ?? null}
        alt={alt}
        className="size-full transition-transform group-hover:scale-105"
      />
      <span className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/55 text-white">
        <ZoomIn className="size-3.5" />
      </span>
    </button>
  );

  return (
    <>
      {hoverPreview && url ? (
        <HoverCard
          open={hovering && !open}
          onOpenChange={setHovering}
          openDelay={HOVER_DELAY_MS}
          closeDelay={100}
        >
          <HoverCardTrigger asChild>{thumbnail}</HoverCardTrigger>
          <HoverCardContent
            side="right"
            align="start"
            collisionPadding={16}
            className="pointer-events-none w-auto p-1.5"
          >
            <img
              src={url}
              alt={alt}
              className="max-h-[min(70vh,32rem)] max-w-[min(80vw,32rem)] rounded-md bg-muted object-contain"
            />
          </HoverCardContent>
        </HoverCard>
      ) : (
        thumbnail
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] gap-3 p-3 sm:max-w-2xl">
          <DialogTitle className="pr-8 text-base">{alt}</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged pictures. Swipe or use the arrows to see more.
          </DialogDescription>
          {open && (
            <Gallery
              slides={gallery}
              startIndex={Math.min(startIndex, gallery.length - 1)}
            />
          )}
          {action && (
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              {action.label}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Gallery({
  slides,
  startIndex,
}: {
  slides: GallerySlide[];
  startIndex: number;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(startIndex);
  const multiple = slides.length > 1;

  // Keep the caption/counter in sync with the carousel position
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const slide = slides[current] ?? slides[0];

  return (
    <div className="space-y-2">
      <Carousel setApi={setApi} opts={{ startIndex }}>
        <CarouselContent>
          {slides.map((s, i) => (
            <CarouselItem key={`${s.url}-${i}`}>
              <img
                src={s.url}
                alt={s.caption}
                className="max-h-[65vh] w-full rounded-lg bg-muted object-contain"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="flex items-center gap-2">
        {multiple && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            onClick={() => api?.scrollPrev()}
            disabled={current === 0}
            aria-label="Previous picture"
          >
            <ChevronLeft />
          </Button>
        )}
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate font-semibold">{slide.caption}</div>
          {multiple && (
            <div className="text-xs text-muted-foreground">
              {current + 1} / {slides.length}
            </div>
          )}
        </div>
        {multiple && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            onClick={() => api?.scrollNext()}
            disabled={current === slides.length - 1}
            aria-label="Next picture"
          >
            <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}
