// Office build stand-in for src/render/post.ts (build/office-swaps.ts): no world grade, vignette or film
// grain over the pastel comic art; light shafts, dust and the hit edge stay as in v8.
import type { Variant } from '../../types';
import { Post as V8Post } from '../../render/post';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';

export * from '../../render/post';

export class Post extends V8Post {
  override gradeWorld(_ctx: Ctx, _v: View, _variant: Variant, _fade: number): void {
    // ungraded
  }

  override finish(_ctx: Ctx, _v: View, _reduced: boolean): void {
    // no vignette / grain
  }
}
