import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import SearchSelect from "@/components/search-select.tsx";
import { MANUFACTURERS } from "@/lib/manufacturers.ts";
import { DEFAULT_PIECE_NAME, PIECE_NAMES } from "@/lib/piece-names.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import type { DrugWithDetails } from "@/lib/drug-types.ts";
import { errorMessage } from "@/lib/errors.ts";
import { useConfirmDiscard, useUnsavedChanges } from "@/hooks/use-unsaved-changes.ts";
import {
  drugFormSchema,
  type DrugFormInput,
  type DrugFormValues,
} from "../_lib/drug-form-schema.ts";
import ImagePicker, { type PickedImage } from "./image-picker.tsx";
import PackageRowsEditor from "./package-rows-editor.tsx";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drug?: DrugWithDetails;
};

function defaultsFor(drug?: DrugWithDetails): DrugFormInput {
  if (!drug) {
    return {
      drugId: "",
      name: "",
      brandName: "",
      manufacturer: "",
      pieceName: DEFAULT_PIECE_NAME,
      specifications: "",
      remarks: "",
      packages: [],
    };
  }
  return {
    drugId: drug.drugId,
    name: drug.name,
    brandName: drug.brandName,
    manufacturer: drug.manufacturer,
    pieceName: drug.pieceName,
    specifications: drug.specifications ?? "",
    remarks: drug.remarks ?? "",
    packages: drug.packages.map((p) => ({
      packageId: p._id,
      barcode: p.barcode,
      qtyPerUnit: p.qtyPerUnit,
      baseUnit: p.baseUnit,
      unitCount: p.unitCount,
      stock: p.stock,
      images: p.images,
    })),
  };
}

function DrugForm({ drug, onSaved, onCancel }: { drug?: DrugWithDetails; onSaved: () => void; onCancel: () => void }) {
  const create = useMutation(api.drugs.create);
  const update = useMutation(api.drugs.update);
  const form = useForm<DrugFormInput, unknown, DrugFormValues>({
    resolver: zodResolver(drugFormSchema),
    defaultValues: defaultsFor(drug),
  });
  const [mainImage, setMainImage] = useState<PickedImage[]>(
    drug?.imageId ? [{ id: drug.imageId, url: drug.imageUrl }] : [],
  );
  const imageChanged = (mainImage[0]?.id ?? null) !== (drug?.imageId ?? null);
  useUnsavedChanges(form.formState.isDirty || imageChanged);

  const onSubmit = async (values: DrugFormValues) => {
    const payload = {
      ...values,
      imageId: mainImage[0]?.id,
      packages: values.packages.map(({ images, ...p }) => ({ ...p, imageIds: images.map((i) => i.id) })),
    };
    try {
      if (drug) await update({ id: drug._id, ...payload });
      else await create(payload);
      toast.success(drug ? "Drug updated" : "Drug added");
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e, "Could not save drug"));
    }
  };

  const textField = (name: "drugId" | "name" | "brandName", label: string, placeholder: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} placeholder={placeholder} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const selectField = (
    name: "pieceName" | "manufacturer",
    label: string,
    options: readonly string[],
    placeholder: string,
    // Manufacturer: free text and clearable. Pieces: list only, always set.
    flexible: boolean,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <SearchSelect
              value={field.value}
              onChange={field.onChange}
              options={options}
              placeholder={placeholder}
              allowClear={flexible}
              allowCustom={flexible}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const noteField = (name: "specifications" | "remarks", label: string, placeholder: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea {...field} rows={2} placeholder={placeholder} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {textField("drugId", "Drug ID", "e.g. PCM500")}
          {textField("name", "Drug name", "e.g. Paracetamol 500mg")}
          {textField("brandName", "Brand name", "e.g. Panadol")}
          {selectField("pieceName", "Pieces are called", PIECE_NAMES, "Search and select", false)}
        </div>
        {selectField("manufacturer", "Manufacturer", MANUFACTURERS, "Search and select a manufacturer", true)}
        <div className="grid gap-4 sm:grid-cols-2">
          {noteField("specifications", "Specifications", "e.g. White round tablet, scored")}
          {noteField("remarks", "Remarks", "e.g. Store below 25°C")}
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Drug picture</div>
          <p className="text-xs text-muted-foreground">One picture of the drug itself, shared by every package form.</p>
          <ImagePicker images={mainImage} onChange={setMainImage} max={1} />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Barcodes, package forms and stock</div>
          <p className="text-xs text-muted-foreground">
            Scan each barcode twice to confirm it, then fill in its package form (quantity per base unit x number of base units, e.g. 10/Strip x10), how many you hold, and its packaging pictures.
          </p>
          <PackageRowsEditor control={form.control} />
          {form.formState.errors.packages?.root?.message || form.formState.errors.packages?.message ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.packages?.root?.message ?? form.formState.errors.packages?.message}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            {drug ? "Save changes" : "Add drug"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function DrugFormDialog({ open, onOpenChange, drug }: Props) {
  const confirmDiscard = useConfirmDiscard();
  // Closing by Cancel, Escape, the X or clicking outside asks first if anything changed
  const requestClose = async () => {
    if (await confirmDiscard()) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : void requestClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{drug ? `Edit ${drug.name}` : "Add drug"}</DialogTitle>
        </DialogHeader>
        {open && (
          <DrugForm
            key={drug?._id ?? "new"}
            drug={drug}
            onSaved={() => onOpenChange(false)}
            onCancel={() => void requestClose()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
