import { Spinner } from "@/components/ui/spinner.tsx";

type Props = {
  caption: string;
  src: string | null;
  alt: string;
  // Size of the preview box for the label size and direction
  className: string;
};

// One label preview with a caption, or a spinner while it is drawn
export default function LabelPreview({ caption, src, alt, className }: Props) {
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {caption}
      </figcaption>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`${className} rounded-sm bg-white shadow-sm [image-rendering:pixelated]`}
        />
      ) : (
        <div className={`${className} flex items-center justify-center`}>
          <Spinner />
        </div>
      )}
    </figure>
  );
}
