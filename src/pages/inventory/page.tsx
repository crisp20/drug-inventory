import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ImageUp, PackageSearch, Plus, Upload } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import DrugSearchInput from "@/components/drug-search-input.tsx";
import PageHeader from "@/components/page-header.tsx";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import type { DrugWithDetails } from "@/lib/drug-types.ts";
import DrugDetailSheet from "./_components/drug-detail-sheet.tsx";
import DrugFormDialog from "./_components/drug-form-dialog.tsx";
import DrugRow from "./_components/drug-row.tsx";
import ImportDialog from "./_components/import-dialog.tsx";
import PhotoImportDialog from "./_components/photo-import-dialog.tsx";

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

function DrugList({ drugs, onSelect }: { drugs: DrugWithDetails[]; onSelect: (d: DrugWithDetails) => void }) {
  return (
    <div className="space-y-3">
      {drugs.map((d) => (
        <DrugRow key={d._id} drug={d} onSelect={() => onSelect(d)} />
      ))}
    </div>
  );
}

function AllDrugs({ isAdmin, onAdd, onSelect }: { isAdmin: boolean; onAdd: () => void; onSelect: (d: DrugWithDetails) => void }) {
  const { results, status, loadMore } = usePaginatedQuery(api.drugs.list, {}, { initialNumItems: 30 });
  if (status === "LoadingFirstPage") return <ListSkeleton />;
  if (status === "Exhausted" && results.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageSearch />
          </EmptyMedia>
          <EmptyTitle>No drugs yet</EmptyTitle>
          <EmptyDescription>
            {isAdmin ? "Add your first drug to start tracking stock." : "An admin has not added any drugs yet."}
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
        <Button variant="secondary" className="w-full" onClick={() => loadMore(30)}>
          Load more
        </Button>
      )}
    </div>
  );
}

function SearchResults({ term, onSelect }: { term: string; onSelect: (d: DrugWithDetails) => void }) {
  const results = useQuery(api.drugs.search, { term });
  if (results === undefined) return <ListSkeleton />;
  if (results.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageSearch />
          </EmptyMedia>
          <EmptyTitle>No match for “{term}”</EmptyTitle>
          <EmptyDescription>Try another barcode, name, brand or Drug ID.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <DrugList drugs={results} onSelect={onSelect} />;
}

export default function InventoryPage() {
  const user = useCurrentUser();
  const isAdmin = user?.role === "director";
  const [search, setSearch] = useState("");
  const [term] = useDebounce(search.trim(), 250);
  const [selected, setSelected] = useState<DrugWithDetails | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DrugWithDetails | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  // Keep the open detail panel in sync with live data
  const live = useQuery(api.drugs.get, selected ? { id: selected._id } : "skip");
  const shown = selected ? (live === undefined ? selected : live) : null;

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        title="Inventory"
        description="Every drug, barcode and package form with its stock on hand."
        actions={
          isAdmin && (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload /> Import file
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
        {term ? (
          <SearchResults term={term} onSelect={setSelected} />
        ) : (
          <AllDrugs isAdmin={isAdmin} onAdd={openAdd} onSelect={setSelected} />
        )}
      </div>
      <DrugDetailSheet
        drug={shown}
        isAdmin={isAdmin}
        onClose={() => setSelected(null)}
        onEdit={(d) => {
          setEditing(d);
          setFormOpen(true);
        }}
      />
      <DrugFormDialog open={formOpen} onOpenChange={setFormOpen} drug={editing} />
      {isAdmin && <ImportDialog open={importOpen} onOpenChange={setImportOpen} />}
      {isAdmin && <PhotoImportDialog open={photosOpen} onOpenChange={setPhotosOpen} />}
    </div>
  );
}
