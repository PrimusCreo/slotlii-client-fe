import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignatureCanvas } from '@/components/doctor/SignatureCanvas';
import { trimSignatureDataUrl } from '@/utils/signatureTrim';

/**
 * In-clinic signing dialog. Staff hands the device to the patient (or guardian)
 * and they enter their name, choose the relation, then draw a signature.
 *
 * Submitting calls the staff-sign endpoint via `onSign`. We trim the signature
 * client-side before sending so the server stores a tight crop.
 */
export function ConsentSignDialog({
  open,
  consent,
  defaultPatientName = '',
  onCancel,
  onSign,
  saving = false,
}) {
  const [signerName, setSignerName] = useState('');
  const [signerRelation, setSignerRelation] = useState('self');
  const [signatureData, setSignatureData] = useState('');

  useEffect(() => {
    if (!open) return;
    setSignerName(defaultPatientName || '');
    setSignerRelation(
      consent?.templateSnapshot?.requiresGuardian ? 'guardian' : 'self',
    );
    setSignatureData('');
  }, [open, consent, defaultPatientName]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signerName.trim() || !signatureData) return;
    const trimmed = await trimSignatureDataUrl(signatureData);
    onSign({
      signerName: signerName.trim(),
      signerRelation,
      signatureData: trimmed || signatureData,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel?.()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sign consent</DialogTitle>
          <DialogDescription>
            Confirm the signer's name and sign in the box below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sg-name">Full name *</Label>
            <Input
              id="sg-name"
              required
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. Mike Smith"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Signing as</Label>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sg-relation"
                  value="self"
                  checked={signerRelation === 'self'}
                  onChange={() => setSignerRelation('self')}
                />
                Self (the patient)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sg-relation"
                  value="guardian"
                  checked={signerRelation === 'guardian'}
                  onChange={() => setSignerRelation('guardian')}
                />
                Guardian
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Signature *</Label>
            <SignatureCanvas
              value={signatureData}
              onChange={setSignatureData}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !signerName.trim() || !signatureData}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Submit signature'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
