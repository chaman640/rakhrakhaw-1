import ApiError from '../utils/ApiError.js';
import { TutorialVideo } from '../models/index.js';

/**
 * TUTORIAL VIDEOS — poora service ek hi jagah (Part 29).
 *
 * Padhna (list/get) sabke liye hai — koi bhi logged-in dukaandaar/staff/
 * retailer apne kaam ka video dekh sake. Likhna (upsert/delete) sirf
 * platform admin ke liye — `requirePartnerAdmin` route me lagti hai, yahan
 * nahi (service ko ye jaanne ki zarurat nahi ki kaun bula raha hai).
 */

export async function listTutorials() {
  return TutorialVideo.find().sort({ order: 1, title: 1 }).lean();
}

/** Sirf onboarding tour wale, kram me — pehli baar wale safar ke liye */
export async function listOnboardingTour() {
  return TutorialVideo.find({ inOnboardingTour: true }).sort({ order: 1 }).lean();
}

export async function getTutorial(key) {
  const doc = await TutorialVideo.findOne({ key }).lean();
  if (!doc) return null;
  return doc;
}

export async function upsertTutorial(payload) {
  const { key, title, order, inOnboardingTour, videos } = payload;
  return TutorialVideo.findOneAndUpdate(
    { key },
    { $set: { title, order, inOnboardingTour, videos } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function deleteTutorial(key) {
  const res = await TutorialVideo.deleteOne({ key });
  if (!res.deletedCount) throw ApiError.notFound('Ye tutorial nahi mila');
  return { deleted: true };
}
