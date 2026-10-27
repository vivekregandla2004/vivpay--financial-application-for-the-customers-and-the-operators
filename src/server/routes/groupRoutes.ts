/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import { requireCustomerAuth, AuthenticatedRequest } from '../auth/middleware.ts';
import { groupsStore } from '../../lib/groups/store.ts';
import { supabaseGroupsRepo } from '../db/supabaseRepository.ts';
import { GroupVisibilityTier } from '../../lib/groups/types.ts';

export const groupRouter = Router();

// Protect all group routes with authentication
groupRouter.use(requireCustomerAuth);

/**
 * GET /api/groups
 * List all collaborative groups the authenticated user belongs to
 */
groupRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    let groups: any[] = [];
    try {
      groups = await supabaseGroupsRepo.listGroupsForCustomer(req.customer!.id);
    } catch (dbErr: any) {
      console.warn('Supabase groups fetch note:', dbErr.message);
    }

    if (!groups || groups.length === 0) {
      groups = groupsStore.listGroupsForCustomer(req.customer!.id);
    }

    return res.json({
      groups,
      count: groups.length,
    });
  } catch (error: any) {
    console.error('Error fetching groups:', error);
    return res.status(500).json({ error: 'Failed to retrieve collaborative groups.' });
  }
});

/**
 * POST /api/groups
 * Create a new collaborative group
 */
groupRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    let group = groupsStore.createGroup(
      req.customer!.id,
      req.customer!.fullName,
      req.customer!.email,
      name.trim(),
      description?.trim()
    );

    try {
      const dbGroup = await supabaseGroupsRepo.createGroup(
        req.customer!.id,
        name.trim(),
        description?.trim()
      );
      if (dbGroup) group = dbGroup;
    } catch (dbErr: any) {
      console.warn('Supabase group create note:', dbErr.message);
    }

    return res.status(201).json({
      message: 'Collaborative group created.',
      group,
    });
  } catch (error: any) {
    console.error('Error creating group:', error);
    return res.status(500).json({ error: 'Failed to create group.' });
  }
});

/**
 * GET /api/groups/:groupId
 * Retrieve group details and privacy-sanitized snapshot.
 * Enforces member authorization and visibility tiers.
 */
groupRouter.get('/:groupId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const snapshot = groupsStore.getGroupSnapshot(groupId, req.customer!.id);
    return res.json({ snapshot });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('not authorized')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error retrieving group snapshot:', error);
    return res.status(500).json({ error: 'Failed to retrieve group snapshot.' });
  }
});

/**
 * POST /api/groups/:groupId/members
 * Add a new member to a group (Admin only)
 */
groupRouter.post('/:groupId/members', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { customerId, fullName, email, visibility } = req.body;

    if (!customerId || !fullName || !email) {
      return res.status(400).json({ error: 'customerId, fullName, and email are required.' });
    }

    const updated = groupsStore.addMember(groupId, req.customer!.id, {
      customerId,
      fullName,
      email,
      visibility: visibility as GroupVisibilityTier,
    });

    try {
      await supabaseGroupsRepo.addMember(groupId, {
        customerId,
        fullName,
        email,
        role: 'member',
        visibility: visibility || 'category_only',
        joinedAt: new Date().toISOString(),
      });
    } catch (dbErr: any) {
      console.warn('Supabase add member note:', dbErr.message);
    }

    return res.status(201).json({
      message: 'Member added to group.',
      group: updated,
    });
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to add member.' });
  }
});

/**
 * DELETE /api/groups/:groupId/members/:targetCustomerId
 * Remove a member (Admin or self-removal)
 */
groupRouter.delete('/:groupId/members/:targetCustomerId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId, targetCustomerId } = req.params;
    const updated = groupsStore.removeMember(groupId, req.customer!.id, targetCustomerId);

    try {
      await supabaseGroupsRepo.removeMember(groupId, targetCustomerId);
    } catch (dbErr: any) {
      console.warn('Supabase remove member note:', dbErr.message);
    }

    return res.json({
      message: 'Member removed from group.',
      group: updated,
    });
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to remove member.' });
  }
});

/**
 * PATCH /api/groups/:groupId/visibility
 * Update authenticated user's visibility tier
 */
groupRouter.patch('/:groupId/visibility', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { visibility } = req.body;

    const validTiers: GroupVisibilityTier[] = ['full', 'category_only', 'total_only', 'hidden'];
    if (!visibility || !validTiers.includes(visibility)) {
      return res.status(400).json({
        error: `Visibility tier must be one of: ${validTiers.join(', ')}`,
      });
    }

    const updated = groupsStore.updateVisibilityTier(groupId, req.customer!.id, visibility);

    try {
      await supabaseGroupsRepo.updateMemberVisibility(groupId, req.customer!.id, visibility);
    } catch (dbErr: any) {
      console.warn('Supabase update visibility note:', dbErr.message);
    }

    return res.json({
      message: `Visibility tier updated to ${visibility}.`,
      group: updated,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to update visibility.' });
  }
});

/**
 * POST /api/groups/:groupId/expenses
 * Add a shared expense
 */
groupRouter.post('/:groupId/expenses', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { title, amount, category, date, splits } = req.body;

    if (!title || typeof title !== 'string' || !amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Valid title and positive amount are required.' });
    }

    const expense = groupsStore.addSharedExpense(groupId, req.customer!.id, {
      title,
      amount,
      category: category || 'Shared General',
      date,
      splits,
    });

    try {
      await supabaseGroupsRepo.addSharedExpense(groupId, {
        groupId,
        title,
        amount,
        paidBy: req.customer!.id,
        splitType: 'equal',
        splits: splits || [],
        category: category || 'Shared General',
        date: date || new Date().toISOString().split('T')[0],
        isSettled: false,
      });
    } catch (dbErr: any) {
      console.warn('Supabase add shared expense note:', dbErr.message);
    }

    return res.status(201).json({
      message: 'Shared expense added.',
      expense,
    });
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to add shared expense.' });
  }
});
