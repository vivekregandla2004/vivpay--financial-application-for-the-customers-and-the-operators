/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import { requireCustomerAuth, AuthenticatedRequest } from '../auth/middleware.ts';
import { supabaseChatRepo } from '../db/supabaseRepository.ts';

export const conversationRouter = Router();

// Protect all conversation routes with authentication
conversationRouter.use(requireCustomerAuth);

/**
 * GET /api/conversations
 * List the authenticated customer's conversation threads from Supabase
 */
conversationRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const threads = await supabaseChatRepo.listThreadsByCustomer(req.customer!.id);
    return res.json({
      threads,
      count: threads.length,
    });
  } catch (error: any) {
    console.error('Error fetching threads from Supabase:', error);
    return res.status(500).json({ error: 'Failed to retrieve conversation threads.' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation thread in Supabase
 */
conversationRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title } = req.body;
    const threadTitle = title && typeof title === 'string' && title.trim().length > 0
      ? title.trim()
      : 'Financial Consultation';

    const thread = await supabaseChatRepo.createThread(req.customer!.id, threadTitle);

    return res.status(201).json({
      message: 'Conversation thread created in Supabase.',
      thread,
    });
  } catch (error: any) {
    console.error('Error creating conversation thread in Supabase:', error);
    return res.status(500).json({ error: 'Failed to create conversation thread.' });
  }
});

/**
 * GET /api/conversations/:threadId
 * Retrieve an owned thread along with its message history from Supabase
 */
conversationRouter.get('/:threadId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const thread = await supabaseChatRepo.getThreadById(threadId, req.customer!.id);

    if (!thread) {
      return res.status(404).json({ error: 'Conversation thread not found or access denied.' });
    }

    const messages = await supabaseChatRepo.listMessagesByThread(threadId, req.customer!.id);

    return res.json({
      thread,
      messages,
      messageCount: messages.length,
    });
  } catch (error: any) {
    console.error('Error fetching conversation from Supabase:', error);
    return res.status(500).json({ error: 'Failed to retrieve conversation.' });
  }
});

/**
 * PATCH /api/conversations/:threadId
 * Update thread title in Supabase
 */
conversationRouter.patch('/:threadId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Thread title cannot be empty.' });
    }

    const updated = await supabaseChatRepo.updateThreadTitle(threadId, req.customer!.id, title);
    if (!updated) {
      return res.status(404).json({ error: 'Conversation thread not found or access denied.' });
    }

    return res.json({
      message: 'Conversation thread updated in Supabase.',
      thread: updated,
    });
  } catch (error: any) {
    console.error('Error updating thread in Supabase:', error);
    return res.status(500).json({ error: 'Failed to update conversation thread.' });
  }
});

/**
 * DELETE /api/conversations/:threadId
 * Delete an owned conversation thread and all its messages in Supabase
 */
conversationRouter.delete('/:threadId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const thread = await supabaseChatRepo.getThreadById(threadId, req.customer!.id);

    if (!thread) {
      return res.status(404).json({ error: 'Conversation thread not found or access denied.' });
    }

    await supabaseChatRepo.deleteThread(threadId, req.customer!.id);

    return res.json({
      success: true,
      message: 'Conversation thread deleted from Supabase.',
    });
  } catch (error: any) {
    console.error('Error deleting thread from Supabase:', error);
    return res.status(500).json({ error: 'Failed to delete conversation thread.' });
  }
});

/**
 * POST /api/conversations/:threadId/messages
 * Persist a validated chat message into Supabase
 */
conversationRouter.post('/:threadId/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const { role, content, groundingsJson } = req.body;

    const thread = await supabaseChatRepo.getThreadById(threadId, req.customer!.id);
    if (!thread) {
      return res.status(404).json({ error: 'Conversation thread not found or access denied.' });
    }

    const validRoles = ['user', 'assistant', 'system'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: `Message role must be one of: ${validRoles.join(', ')}` });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const message = await supabaseChatRepo.addMessage(
      req.customer!.id,
      threadId,
      role as any,
      content.trim(),
      typeof groundingsJson === 'string' ? groundingsJson : (groundingsJson ? JSON.stringify(groundingsJson) : undefined)
    );

    return res.status(201).json({
      message: 'Message saved in Supabase.',
      chatMessage: message,
    });
  } catch (error: any) {
    console.error('Error saving message in Supabase:', error);
    return res.status(500).json({ error: 'Failed to persist message.' });
  }
});

/**
 * POST /api/conversations/:threadId/ask
 * Ask Viv AI copilot a question with grounding in customer's verified accounts and transactions.
 * Supports standard JSON responses and SSE streaming (when Accept: text/event-stream or ?stream=true).
 */
conversationRouter.post('/:threadId/ask', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const thread = await supabaseChatRepo.getThreadById(threadId, req.customer!.id);
    if (!thread) {
      return res.status(404).json({ error: 'Conversation thread not found or access denied.' });
    }

    const { processVivFinancialCopilot } = await import('../ai/copilot.ts');
    const isStream = req.headers.accept === 'text/event-stream' || req.query.stream === 'true';

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }

      let isClosed = false;
      req.on('close', () => {
        isClosed = true;
      });

      const result = await processVivFinancialCopilot({
        customerId: req.customer!.id,
        customerProfile: req.customer!,
        threadId,
        userPrompt: prompt.trim(),
        onStreamChunk: (chunk: string) => {
          if (!isClosed) {
            res.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`);
          }
        },
      });

      if (!isClosed) {
        res.write(
          `data: ${JSON.stringify({
            type: 'done',
            reply: result.reply,
            citations: result.citations,
            messageId: result.messageId,
            intent: result.intent,
          })}\n\n`
        );
        res.end();
      }
    } else {
      const result = await processVivFinancialCopilot({
        customerId: req.customer!.id,
        customerProfile: req.customer!,
        threadId,
        userPrompt: prompt.trim(),
      });

      return res.json({
        reply: result.reply,
        citations: result.citations,
        messageId: result.messageId,
        intent: result.intent,
      });
    }
  } catch (error: any) {
    console.error('Copilot processing error:', error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Processing error' })}\n\n`);
      return res.end();
    }
    return res.status(500).json({ error: error.message || 'Failed to process financial copilot query.' });
  }
});

