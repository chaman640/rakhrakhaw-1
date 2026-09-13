import ApiError from '../utils/ApiError.js';
import { saveImage, deleteImage } from '../utils/storage.js';
import { ROLES } from '../config/constants.js';
import { Story, Membership } from '../models/index.js';
import { buyerFilter } from '../utils/buyer.js';

/**
 * STORY — WhatsApp Status jaisa (Part 25). Poori wajah Story.js model me hai.
 */

// Dekhne wale ki pehchan — ek chhota string, poora user object nahi
const viewerKeyFor = (user) => (
  user.role === ROLES.WHOLESALER ? `biz:${user.businessId}` : `user:${user._id}`
);

export async function createStory(businessId, file, caption = '') {
  if (!file) throw ApiError.badRequest('Photo chahiye');
  const { url, publicId } = await saveImage(file, 'stories');
  return Story.create({ businessId, imageUrl: url, imagePublicId: publicId, caption });
}

/** Malik ki apni list — "Meri stories" wala tab, sabki dekhne ki ginti ke saath */
export async function listMyStories(businessId) {
  const stories = await Story.find({ businessId }).sort({ createdAt: -1 }).lean();
  return stories.map((s) => ({ ...s, viewCount: s.viewedBy?.length || 0 }));
}

/**
 * Ek dukaan ki sab stories, dekhne wale ke liye — purani pehle (WhatsApp
 * status jaise ek-ek karke dikhti hain, purani se shuru).
 */
export async function getStoriesForViewer(businessId, user) {
  // Sirf jude hue retailer hi story dekh sakte hain — koi bhi seedha URL se nahi
  const mine = buyerFilter(user);
  const connected = mine && await Membership.exists({ ...mine, businessId });
  if (!connected) throw ApiError.forbidden('Aap is dukaan se jude nahi hain');

  const stories = await Story.find({ businessId }).sort({ createdAt: 1 }).lean();
  const myKey = viewerKeyFor(user);
  return stories.map((s) => ({
    _id: s._id,
    imageUrl: s.imageUrl,
    caption: s.caption,
    createdAt: s.createdAt,
    seen: s.viewedBy?.includes(myKey) || false,
  }));
}

export async function markViewed(storyId, user) {
  await Story.updateOne({ _id: storyId }, { $addToSet: { viewedBy: viewerKeyFor(user) } });
}

/**
 * Ring rangeen hogi ya sadi — kisi bhi story me se ek bhi ANDEKHI ho to
 * rangeen (WhatsApp jaisa). Shop-list/header dono jagah isi se kaam chalta hai.
 */
export async function hasUnseenStory(businessId, user) {
  const myKey = viewerKeyFor(user);
  const count = await Story.countDocuments({ businessId, viewedBy: { $ne: myKey } });
  return count > 0;
}

export async function deleteStory(businessId, storyId) {
  const story = await Story.findOne({ _id: storyId, businessId });
  if (!story) throw ApiError.notFound('Story nahi mili');
  if (story.imagePublicId) await deleteImage(story.imagePublicId);
  await Story.deleteOne({ _id: story._id });
  return { deleted: true };
}
