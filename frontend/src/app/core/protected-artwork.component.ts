import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-protected-artwork',
  standalone: true,
  template: `
    <div
      class="protected-artwork-wrap"
      (contextmenu)="blockEvent($event)"
      (dragstart)="blockEvent($event)"
      (selectstart)="blockEvent($event)"
    >
      <canvas
        #artCanvas
        class="protected-artwork-canvas"
        [attr.aria-label]="alt"
        role="img"
        [width]="showWatermark ? 800 : 480"
        [height]="showWatermark ? 1000 : 600"
      ></canvas>
      <div class="artwork-shield" aria-hidden="true"></div>
    </div>
  `,
})
export class ProtectedArtworkComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) src = '';
  @Input() alt = 'Protected artwork preview';
  @Input() showWatermark = false;
  @ViewChild('artCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private static watermarkLogo: HTMLImageElement | null = null;
  private static logoLoading = false;
  private static logoCallbacks: Array<() => void> = [];

  ngAfterViewInit(): void {
    if (this.showWatermark) {
      this.ensureLogoLoaded();
    }
    this.renderCanvas();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['src'] && !changes['src'].firstChange) || (changes['showWatermark'] && !changes['showWatermark'].firstChange)) {
      if (this.showWatermark) {
        this.ensureLogoLoaded();
      }
      this.renderCanvas();
    }
  }

  @HostListener('contextmenu', ['$event'])
  @HostListener('dragstart', ['$event'])
  blockEvent(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private ensureLogoLoaded(): void {
    if (typeof window === 'undefined' || ProtectedArtworkComponent.watermarkLogo) return;
    if (ProtectedArtworkComponent.logoLoading) return;
    ProtectedArtworkComponent.logoLoading = true;
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.onload = () => {
      ProtectedArtworkComponent.watermarkLogo = logo;
      ProtectedArtworkComponent.logoLoading = false;
      const callbacks = ProtectedArtworkComponent.logoCallbacks.splice(0);
      callbacks.forEach(cb => cb());
    };
    logo.onerror = () => {
      ProtectedArtworkComponent.logoLoading = false;
    };
    logo.src = '/brand/samis-design-watermark.png';
  }

  private renderCanvas(): void {
    if (typeof window === 'undefined' || !this.canvasRef?.nativeElement || !this.src) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Cover-fit drawing onto 800x1000 canvas
      const imgRatio = img.width / Math.max(1, img.height);
      const canvasRatio = w / h;
      let drawW = w;
      let drawH = h;
      let offsetX = 0;
      let offsetY = 0;
      if (imgRatio > canvasRatio) {
        drawW = h * imgRatio;
        offsetX = (w - drawW) / 2;
      } else {
        drawH = w / imgRatio;
        offsetY = (h - drawH) / 2;
      }
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      if (this.showWatermark) {
        this.drawCanvasWatermark(ctx, w, h);
        if (!ProtectedArtworkComponent.watermarkLogo && ProtectedArtworkComponent.logoLoading) {
          ProtectedArtworkComponent.logoCallbacks.push(() => this.renderCanvas());
        }
      }
    };
    img.src = this.src;
  }

  private drawCanvasWatermark(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const rows = [0.12, 0.31, 0.5, 0.69, 0.88];
    const positions: Array<{ x: number; y: number }> = [];
    rows.forEach((ry, rowIndex) => {
      const cols = rowIndex % 2 === 0 ? [0.18, 0.5, 0.82] : [0.06, 0.35, 0.65, 0.94];
      cols.forEach(cx => {
        positions.push({ x: w * cx, y: h * ry });
      });
    });

    const angle = (-24 * Math.PI) / 180;
    const logo = ProtectedArtworkComponent.watermarkLogo;

    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11.5px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const pos of positions) {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      if (logo && logo.width > 0) {
        const lw = 104;
        const lh = (logo.height / logo.width) * lw;
        ctx.drawImage(logo, -lw / 2, -lh / 2 - 6, lw, lh);
        ctx.fillText('sameulshajid.art', 0, lh / 2 - 4);
      } else {
        ctx.fillText('sameulshajid.art', 0, 0);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

