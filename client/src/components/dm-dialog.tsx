import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DmView } from "@/components/dm-view";

interface DmDialogProps {
  otherUserId: string | null;
  onClose: () => void;
}

export function DmDialog({ otherUserId, onClose }: DmDialogProps) {
  return (
    <Dialog open={!!otherUserId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 h-[70vh] max-h-[600px] flex flex-col overflow-hidden" aria-describedby={undefined}>
        {otherUserId && (
          <DmView
            otherUserId={otherUserId}
            onBack={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
