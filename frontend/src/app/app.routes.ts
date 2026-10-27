import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { AuthComponent } from './pages/auth.component';
import { ProductDetailComponent } from './pages/product-detail.component';
import { CartComponent } from './pages/cart.component';
import { CheckoutComponent } from './pages/checkout.component';
import { PaymentResultComponent } from './pages/payment-result.component';
import { CustomWorkComponent } from './pages/custom-work.component';
import { StudioComponent } from './pages/studio.component';
import { ProfileComponent } from './pages/profile.component';
import { designerGuard } from './core/designer.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'sameulshajid.art — Graphic design with intent' },
  { path: 'shop', redirectTo: '', pathMatch: 'full' },
  { path: 'shop/:slug', component: ProductDetailComponent, title: 'Design details — sameulshajid.art' },
  { path: 'cart', component: CartComponent, title: 'Your bag — sameulshajid.art' },
  { path: 'checkout/:orderId', component: CheckoutComponent, title: 'Checkout — sameulshajid.art' },
  { path: 'payment-result', component: PaymentResultComponent, title: 'Payment complete — sameulshajid.art' },
  { path: 'custom-work', component: CustomWorkComponent, title: 'Custom work — sameulshajid.art' },
  { path: 'profile', component: ProfileComponent, title: 'Account settings — sameulshajid.art' },
  { path: 'sign-in', component: AuthComponent, data: { mode: 'login' }, title: 'Sign in — sameulshajid.art' },
  { path: 'register', component: AuthComponent, data: { mode: 'register' }, title: 'Create account — sameulshajid.art' },
  { path: 'studio', component: StudioComponent, canActivate: [designerGuard], title: 'Designer Studio - sameulshajid.art' },
  { path: '**', redirectTo: '' }
];

