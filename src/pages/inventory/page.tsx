import { useState } from "react";
import { useConvex, usePaginatedQuery, useQuery } from "convex/react";
import {
  Download,
  ImageUp,
  PackageSearch,
  Plus,
  ShieldAlert,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Toggle } from "@/components/ui/toggle.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import DrugSearchInput from "@/components/drug-search-input.tsx";
import PageHeader from "@/components/page-header.tsx";
import { RoleCatelog, useKeycloakRoles } from "@/hooks/use-keycloak-roles.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import type { DrugWithDetails } from "@/lib/drug-types.ts";
import { errorMessage } from "@/lib/errors.ts";
import DrugDetailSheet from "./_components/drug-detail-sheet.tsx";
import LasaWarningDialog from "@/components/lasa/lasa-warning-dialog.tsx";
import DrugFormDialog from "./_components/drug-form-dialog.tsx";
import DrugRow from "./_components/drug-row.tsx";
import ImportDialog from "./_components/import-dialog.tsx";
import PhotoImportDialog from "./_components/photo-import-dialog.tsx";
import { downloadDrugsCsv } from "./_lib/export-drugs.ts";

// Which marked drugs to show; one at a time so each list can use its own index
type MarkFilter = "all" | "lasa" | "dda";

const FILTER_COPY = {
  lasa: {
    title: "No Look Alike, Sound Alike drugs",
    adminHint: "Edit a drug and switch on Look Alike, Sound Alike to mark it.",
    match: "Look Alike, Sound Alike ",
    icon: TriangleAlert,
  },
  dda: {
    title: "No Dangerous Drugs (DDA)",
    adminHint: "Edit a drug and tick Dangerous Drug (DDA) to mark it.",
    match: "DDA ",
    icon: ShieldAlert,
  },
} as const;

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

function DrugList({
  drugs,
  onSelect,
}: {
  drugs: DrugWithDetails[];
  onSelect: (d: DrugWithDetails) => void;
}) {
  return (
    <div className="space-y-3">
      {drugs.map((d) => (
        <DrugRow key={d._id} drug={d} onSelect={() => onSelect(d)} />
      ))}
    </div>
  );
}

const LIST_QUERY = {
  all: api.drugs.list,
  lasa: api.drugs.listLasa,
  dda: api.drugs.listDda,
} as const;

function AllDrugs({
  isAdmin,
  filter,
  onAdd,
  onSelect,
}: {
  isAdmin: boolean;
  filter: MarkFilter;
  onAdd: () => void;
  onSelect: (d: DrugWithDetails) => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    LIST_QUERY[filter],
    {},
    { initialNumItems: 30 },
  );
  if (status === "LoadingFirstPage") return <ListSkeleton />;
  if (status === "Exhausted" && results.length === 0 && filter !== "all") {
    const copy = FILTER_COPY[filter];
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <copy.icon />
          </EmptyMedia>
          <EmptyTitle>{copy.title}</EmptyTitle>
          <EmptyDescription>
            {isAdmin
              ? copy.adminHint
              : "An admin has not marked any drugs yet."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (status === "Exhausted" && results.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageSearch />
          </EmptyMedia>
          <EmptyTitle>No drugs yet</EmptyTitle>
          <EmptyDescription>
            {isAdmin
              ? "Add your first drug to start tracking stock."
              : "An admin has not added any drugs yet."}
          </EmptyDescription>
        </EmptyHeader>
        {isAdmin && (
          <EmptyContent>
            <Button onClick={onAdd}>
              <Plus /> Add drug
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }
  return (
    <div className="space-y-4">
      <DrugList drugs={results} onSelect={onSelect} />
      {status === "CanLoadMore" && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => loadMore(30)}
        >
          Load more
        </Button>
      )}
    </div>
  );
}

function SearchResults({
  term,
  filter,
  onSelect,
}: {
  term: string;
  filter: MarkFilter;
  onSelect: (d: DrugWithDetails) => void;
}) {
  const found = useQuery(api.drugs.search, { term });
  if (found === undefined) return <ListSkeleton />;
  // Search returns a small capped list, so narrowing it here is safe
  const results = filter === "all" ? found : found.filter((d) => d[filter]);
  if (results.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageSearch />
          </EmptyMedia>
          <EmptyTitle>
            No {filter === "all" ? "" : FILTER_COPY[filter].match}match for “
            {term}”
          </EmptyTitle>
          <EmptyDescription>
            Try another barcode, name, brand or Drug ID.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <DrugList drugs={results} onSelect={onSelect} />;
}

export default function InventoryPage() {
  const { hasRole } = useKeycloakRoles();
  const convex = useConvex();
  const [search, setSearch] = useState("");
  const [term] = useDebounce(search.trim(), 250);
  const [selected, setSelected] = useState<DrugWithDetails | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DrugWithDetails | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<MarkFilter>("all");
  const toggleFilter = (f: Exclude<MarkFilter, "all">) => (on: boolean) =>
    setFilter(on ? f : "all");
  // A marked drug waits here until staff tick the warning, then its details open
  const [pendingLasa, setPendingLasa] = useState<DrugWithDetails | null>(null);
  const openDrug = (d: DrugWithDetails) =>
    d.lasa ? setPendingLasa(d) : setSelected(d);

  // Keep the open detail panel in sync with live data
  const live = useQuery(
    api.drugs.get,
    selected ? { id: selected._id } : "skip",
  );
  const shown = selected ? (live === undefined ? selected : live) : null;

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const count = await downloadDrugsCsv(convex);
      toast.success(`Exported ${count} medicines`);
    } catch (e) {
      toast.error(errorMessage(e, "Could not export medicines"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        title="Inventory"
        description="Every drug, barcode and package form with its stock on hand."
        actions={
          hasRole(RoleCatelog.inventory_manage) && (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload /> Import file
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                {exporting ? <Spinner /> : <Download />} Export file
              </Button>
              <Button variant="secondary" onClick={() => setPhotosOpen(true)}>
                <ImageUp /> Upload photos
              </Button>
              <Button onClick={openAdd}>
                <Plus /> Add drug
              </Button>
            </>
          )
        }
      />
      <div className="space-y-6">
        <DrugSearchInput value={search} onChange={setSearch} autoFocus />
        <div className="flex flex-wrap gap-2">
          <Toggle
            pressed={filter === "lasa"}
            onPressedChange={toggleFilter("lasa")}
            variant="outline"
            className="cursor-pointer data-[state=on]:border-destructive/40 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
          >
            <TriangleAlert /> Look Alike, Sound Alike only
          </Toggle>
          <Toggle
            pressed={filter === "dda"}
            onPressedChange={toggleFilter("dda")}
            variant="outline"
            className="cursor-pointer data-[state=on]:border-amber-500/50 data-[state=on]:bg-amber-500/10 data-[state=on]:text-amber-700 dark:data-[state=on]:text-amber-300"
          >
            <ShieldAlert /> DDA only
          </Toggle>
        </div>
        {term ? (
          <SearchResults term={term} filter={filter} onSelect={openDrug} />
        ) : (
          <AllDrugs
            isAdmin={hasRole(RoleCatelog.inventory_manage)}
            filter={filter}
            onAdd={openAdd}
            onSelect={openDrug}
          />
        )}
      </div>
      <LasaWarningDialog
        drugId={pendingLasa?._id ?? null}
        confirmLabel="Open drug details"
        switchMode="drug"
        onConfirm={() => {
          setSelected(pendingLasa);
          setPendingLasa(null);
        }}
        onSwitch={(other) => {
          setSelected(other);
          setPendingLasa(null);
        }}
        onCancel={() => setPendingLasa(null)}
      />
      <DrugDetailSheet
        drug={shown}
        isAdmin={hasRole(RoleCatelog.inventory_manage)}
        onClose={() => setSelected(null)}
        onEdit={(d) => {
          setEditing(d);
          setFormOpen(true);
        }}
      />
      <DrugFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        drug={editing}
      />
      {hasRole(RoleCatelog.inventory_manage) && (
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      )}
      {hasRole(RoleCatelog.inventory_manage) && (
        <PhotoImportDialog open={photosOpen} onOpenChange={setPhotosOpen} />
      )}
    </div>
  );
}
