import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { Category, Item } from '../models/index.js';

/** Saari categories + har ek me kitne item hain */
export async function listCategories(businessId, { includeInactive = false } = {}) {
  const query = { businessId };
  if (!includeInactive) query.isActive = true;

  const [categories, counts, uncategorized] = await Promise.all([
    Category.find(query).sort({ name: 1 }).lean(),
    Item.aggregate([
      { $match: { businessId: new mongoose.Types.ObjectId(businessId), isActive: true, categoryId: { $ne: null } } },
      { $group: { _id: '$categoryId', n: { $sum: 1 } } },
    ]),
    Item.countDocuments({ businessId, isActive: true, categoryId: null }),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));

  return {
    categories: categories.map((c) => ({ ...c, itemCount: countMap[String(c._id)] || 0 })),
    uncategorizedCount: uncategorized,
  };
}

export async function createCategory(businessId, { name, description }) {
  const exists = await Category.findOne({ businessId, name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  if (exists) throw ApiError.conflict(`"${name}" category pehle se hai`);

  return Category.create({ businessId, name, description });
}

export async function updateCategory(businessId, id, payload) {
  if (payload.name) {
    const clash = await Category.findOne({
      businessId,
      _id: { $ne: id },
      name: new RegExp(`^${escapeRegex(payload.name)}$`, 'i'),
    });
    if (clash) throw ApiError.conflict(`"${payload.name}" category pehle se hai`);
  }

  const category = await Category.findOneAndUpdate({ _id: id, businessId }, payload, { new: true });
  if (!category) throw ApiError.notFound('Category nahi mili');
  return category;
}

/** Category hataao — uske items delete nahi hote, bas "bina category" ho jate hain */
export async function deleteCategory(businessId, id) {
  const category = await Category.findOne({ _id: id, businessId });
  if (!category) throw ApiError.notFound('Category nahi mili');

  const moved = await Item.updateMany({ businessId, categoryId: id }, { categoryId: null });
  await category.deleteOne();

  return { deleted: true, itemsMoved: moved.modifiedCount || 0 };
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
