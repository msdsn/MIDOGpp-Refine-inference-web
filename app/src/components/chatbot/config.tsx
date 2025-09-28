import React from 'react';
import SupportPromptGroup, { type SupportPromptGroupProps } from '@cloudscape-design/chat-components/support-prompt-group';
import StatusIndicator from '@cloudscape-design/components/status-indicator';

export type Message = ChatBubbleMessage | AlertMessage;

type ChatBubbleMessage = {
  type: 'chat-bubble';
  authorId: string;
  content: React.ReactNode;
  timestamp: string;
  actions?: 'code-view';
  hideAvatar?: boolean;
  avatarLoading?: boolean;
  files?: File[];
  supportPrompts?: React.ReactNode;
  contentToCopy?: string;
};

type AlertMessage = {
  type: 'alert';
  content: React.ReactNode;
  header?: string;
};

export type AuthorAvatarProps = {
  type: 'user' | 'gen-ai';
  name: string;
  initials?: string;
  loading?: boolean;
};

type AuthorsType = {
  [key: string]: AuthorAvatarProps;
};

export const AUTHORS: AuthorsType = {
  'user-jane-doe': {
    type: 'user',
    name: 'You',
    initials: 'Y',
  },
  'gen-ai': {
    type: 'gen-ai',
    name: 'AI Assistant',
    initials: 'AI',
  },
};

export const supportPromptItems: SupportPromptGroupProps.Item[] = [
  {
    id: 'analysis-help',
    text: 'How do I analyze an image?',
  },
  {
    id: 'results-help',
    text: 'How do I interpret the analysis results?',
  }
];



type ValidPromptType = {
  prompt: Array<string>;
  getResponse: (onSupportPromptClick?: (detail: SupportPromptGroupProps.ItemClickDetail) => void) => Message;
};

export const VALID_PROMPTS: Array<ValidPromptType> = [
  {
    prompt: ['how do i analyze', 'analyze image', 'upload image'],
    getResponse: () => ({
      type: 'chat-bubble' as const,
      authorId: 'gen-ai',
      content: (
        <div>
          <p>To analyze an image with our AI system:</p>
          <ol>
            <li>Go to the "New Analysis" page</li>
            <li>Upload your image (PNG, JPG, JPEG, TIFF formats supported)</li>
            <li>Select the AI model you want to use</li>
            <li>Click "Start Analysis" and wait for the results</li>
          </ol>
          <p>The system will detect mitotic figures in your image and provide detailed results with bounding boxes and confidence scores.</p>
        </div>
      ),
      timestamp: new Date().toLocaleTimeString(),
      actions: 'code-view' as const,
      contentToCopy: 'To analyze an image: 1. Go to New Analysis page, 2. Upload image, 3. Select model, 4. Start analysis',
      supportPrompts: (
        ''
        // <SupportPromptGroup
        //   items={supportPromptItems}
        //   onItemClick={({ detail }) => onSupportPromptClick?.(detail)}
        //   ariaLabel="Related prompts"
        // />
      ),
    }),
  },
  {
    prompt: ['results', 'interpret results', 'understand results'],
    getResponse: () => ({
      type: 'chat-bubble' as const,
      authorId: 'gen-ai',
      content: (
        <div>
          <p>Analysis results include:</p>
          <ul>
            <li><strong>Detection Count:</strong> Number of mitotic figures found</li>
            <li><strong>Confidence Scores:</strong> How certain the AI is about each detection (0-100%)</li>
            <li><strong>Bounding Boxes:</strong> Visual markers showing detected regions</li>
            <li><strong>Processing Time:</strong> How long the analysis took</li>
          </ul>
          <p>Higher confidence scores indicate more reliable detections. You can filter results by confidence threshold in the results view.</p>
        </div>
      ),
      timestamp: new Date().toLocaleTimeString(),
      actions: 'code-view' as const,
      contentToCopy: 'Results include detection count, confidence scores, bounding boxes, and processing time.',
    }),
  },
  {
    prompt: ['models', 'available models', 'which model'],
    getResponse: () => ({
      type: 'chat-bubble' as const,
      authorId: 'gen-ai',
      content: (
        <div>
          <p>Available AI models:</p>
          <ul>
            <li><strong>MIDOGpp-Refine:</strong> Our latest high-accuracy model optimized for mitotic figure detection</li>
            <li><strong>Performance:</strong> High precision with excellent recall rates</li>
            <li><strong>Best for:</strong> Medical research and diagnostic applications</li>
          </ul>
          <p>The model uses advanced deep learning techniques trained on extensive histopathology datasets.</p>
        </div>
      ),
      timestamp: new Date().toLocaleTimeString(),
      actions: 'code-view' as const,
      contentToCopy: 'MIDOGpp-Refine model available - high-accuracy mitotic figure detection for medical research.',
    }),
  },
  {
    prompt: ['history', 'past analyses', 'view history'],
    getResponse: () => ({
      type: 'chat-bubble' as const,
      authorId: 'gen-ai',
      content: (
        <div>
          <p>To view your analysis history:</p>
          <ol>
            <li>Click on "History" in the navigation menu</li>
            <li>Browse your past analyses with thumbnails and details</li>
            <li>Click on any analysis to view detailed results</li>
            <li>Use filters to find specific analyses by date or status</li>
          </ol>
          <p>Your analysis history includes all uploaded images, results, and processing details.</p>
        </div>
      ),
      timestamp: new Date().toLocaleTimeString(),
      actions: 'code-view' as const,
      contentToCopy: 'View history: Navigate to History page, browse past analyses, click for details, use filters.',
    }),
  },
  {
    prompt: ['file'],
    getResponse: () => ({
      type: 'chat-bubble' as const,
      authorId: 'gen-ai',
      content: (
        <div>
          <p>I see you've attached a file. Currently, I can help you with:</p>
          <ul>
            <li>Understanding how to use the analysis system</li>
            <li>Interpreting results from your analyses</li>
            <li>Navigating the application features</li>
            <li>Troubleshooting common issues</li>
          </ul>
          <p>For image analysis, please use the "New Analysis" page to upload and process your images.</p>
        </div>
      ),
      timestamp: new Date().toLocaleTimeString(),
      actions: 'code-view' as const,
      contentToCopy: 'For image analysis, use the New Analysis page to upload and process images.',
    }),
  },
];

export const validLoadingPrompts = ['loading', 'processing', 'analyzing'];

export const getInitialMessages = (onSupportPromptClick: (detail: SupportPromptGroupProps.ItemClickDetail) => void): Array<Message> => [
  {
    type: 'chat-bubble',
    authorId: 'gen-ai',
    content: (
      <div>
        <p>👋 Hello! I'm your AI assistant for the Mitotic Figure Detection system.</p>
        <p>I can help you with:</p>
        <ul>
          <li>How to analyze images</li>
          <li>Understanding your results</li>
          <li>Using different features</li>
          <li>Troubleshooting issues</li>
        </ul>
        <p>What would you like to know?</p>
      </div>
    ),
    timestamp: new Date().toLocaleTimeString(),
    supportPrompts: (
      <SupportPromptGroup
        items={supportPromptItems}
        onItemClick={({ detail }) => onSupportPromptClick(detail)}
        ariaLabel="Suggested prompts"
      />
    ),
  },
];

export const getLoadingMessage = (): Message => ({
  type: 'chat-bubble',
  authorId: 'gen-ai',
  content: <StatusIndicator type="loading">Thinking...</StatusIndicator>,
  timestamp: new Date().toLocaleTimeString(),
  avatarLoading: true,
});

export const getInvalidPromptResponse = (): Message => ({
  type: 'chat-bubble',
  authorId: 'gen-ai',
  content: (
    <div>
      <p>I'm sorry, I didn't understand that question. I'm specialized in helping with the Mitotic Figure Detection system.</p>
      <p>I can help you with:</p>
      <ul>
        <li>How to analyze images</li>
        <li>Understanding analysis results</li>
        <li>Available models and features</li>
        <li>Viewing your analysis history</li>
      </ul>
      <p>Please try asking about one of these topics!</p>
    </div>
  ),
  timestamp: new Date().toLocaleTimeString(),
  contentToCopy: 'I can help with image analysis, results interpretation, models, and viewing history.',
});

export const supportPromptMessageOne: Message = {
  type: 'chat-bubble',
  authorId: 'gen-ai',
  content: (
    <div>
      <p>Here's how to analyze an image step by step:</p>
      <ol>
        <li><strong>Navigate:</strong> Go to "New Analysis" from the menu</li>
        <li><strong>Upload:</strong> Click "Upload Image" and select your file</li>
        <li><strong>Configure:</strong> Choose your preferred AI model</li>
        <li><strong>Analyze:</strong> Click "Start Analysis" and wait for completion</li>
      </ol>
      <p>Supported formats: PNG, JPG, JPEG, TIFF. The analysis will detect mitotic figures and provide confidence scores.</p>
    </div>
  ),
  timestamp: new Date().toLocaleTimeString(),
  actions: 'code-view',
  contentToCopy: 'To analyze: 1. Go to New Analysis, 2. Upload image, 3. Choose model, 4. Start analysis',
};

export const supportPromptMessageTwo: Message = {
  type: 'chat-bubble',
  authorId: 'gen-ai',
  content: (
    <div>
      <p>Understanding your analysis results:</p>
      <ul>
        <li><strong>Detection Boxes:</strong> Red rectangles highlight detected mitotic figures</li>
        <li><strong>Confidence Score:</strong> Percentage showing AI certainty (higher = more confident)</li>
        <li><strong>Total Count:</strong> Number of mitotic figures detected</li>
        <li><strong>Processing Info:</strong> Analysis time and model used</li>
      </ul>
      <p>You can adjust the confidence threshold to filter results and focus on the most reliable detections.</p>
    </div>
  ),
  timestamp: new Date().toLocaleTimeString(),
  actions: 'code-view',
  contentToCopy: 'Results show detection boxes, confidence scores, total count, and processing info.',
};

export const fileTokenGroupI18nStrings = {
  limitShowFewer: 'Show fewer files',
  limitShowMore: 'Show more files',
  dismissButtonAriaLabel: (index: number) => `Remove file ${index + 1}`,
  errorIconAriaLabel: 'Error',
  warningIconAriaLabel: 'Warning',
};
