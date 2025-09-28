import { useEffect, useRef, useState } from 'react';

import type { SupportPromptGroupProps } from '@cloudscape-design/chat-components/support-prompt-group';
import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import FileDropzone, { useFilesDragging } from '@cloudscape-design/components/file-dropzone';
import FileInput from '@cloudscape-design/components/file-input';
import FileTokenGroup from '@cloudscape-design/components/file-token-group';
import Header from '@cloudscape-design/components/header';
import Icon from '@cloudscape-design/components/icon';
import PromptInput from '@cloudscape-design/components/prompt-input';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { ScrollableContainer } from './common-components';
import {
  fileTokenGroupI18nStrings,
  getInitialMessages,
  getInvalidPromptResponse,
  getLoadingMessage,
  type Message,
  supportPromptItems,
  supportPromptMessageOne,
  supportPromptMessageTwo,
  VALID_PROMPTS,
  validLoadingPrompts,
} from './config';
import Messages from './Messages';


export default function Chatbot() {
  const waitTimeBeforeLoading = 300;
  const waitTimeBeforeResponse = (isLoadingPrompt: boolean = false) => (isLoadingPrompt ? 4000 : 1500);

  const [prompt, setPrompt] = useState('');
  const [isGenAiResponseLoading, setIsGenAiResponseLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const { areFilesDragging } = useFilesDragging();

  const onSupportPromptClick = (detail: SupportPromptGroupProps.ItemClickDetail) => {
    let newMessage: Message;

    if (detail.id === 'analysis-help') {
      newMessage = supportPromptMessageOne;
    } else if (detail.id === 'results-help') {
      newMessage = supportPromptMessageTwo;
    }

    const supportPromptText = supportPromptItems.find(item => item.id === detail.id)?.text;

    const newUserMessage: Message = {
      type: 'chat-bubble',
      authorId: 'user-jane-doe',
      content: supportPromptText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prevMessages => [...prevMessages, newUserMessage]);

    promptInputRef.current?.focus();

    setTimeout(() => {
      setIsGenAiResponseLoading(true);
      setMessages(prevMessages => [...prevMessages, getLoadingMessage()]);

      setTimeout(() => {
        setMessages(prevMessages => {
          prevMessages.splice(prevMessages.length - 1, 1, newMessage);
          return [...prevMessages];
        });
        setIsGenAiResponseLoading(false);
      }, waitTimeBeforeResponse());
    }, waitTimeBeforeLoading);
  };

  const lastMessageContent = messages[messages.length - 1]?.content;

  useEffect(() => {
    setMessages(getInitialMessages(onSupportPromptClick));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Scroll to the bottom to show the new/latest message
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 0);
  }, [lastMessageContent]);

  const onPromptSend = ({ detail: { value } }: { detail: { value: string } }) => {
    if ((!value && files.length === 0) || (value.length === 0 && files.length === 0) || isGenAiResponseLoading) {
      return;
    }

    const newMessage: Message = {
      type: 'chat-bubble',
      authorId: 'user-jane-doe',
      content: value,
      timestamp: new Date().toLocaleTimeString(),
      files,
    };

    let fileValue = files;

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setPrompt('');
    setFiles([]);

    const lowerCasePrompt = value.toLowerCase();

    const isLoadingPrompt = validLoadingPrompts.includes(lowerCasePrompt);

    // Show loading state
    setTimeout(() => {
      setIsGenAiResponseLoading(true);
      setMessages(prevMessages => [...prevMessages, getLoadingMessage()]);

      setTimeout(() => {
        const validPrompt =
          fileValue.length > 0
            ? VALID_PROMPTS.find(({ prompt }) => prompt.includes('file'))
            : VALID_PROMPTS.find(({ prompt }) => prompt.some(p => lowerCasePrompt.includes(p)));

        // Send Gen-AI response, replacing the loading chat bubble
        setMessages(prevMessages => {
          const response = validPrompt ? validPrompt.getResponse(onSupportPromptClick) : getInvalidPromptResponse();

          prevMessages.splice(prevMessages.length - 1, 1, response);
          return [...prevMessages];
        });
        setIsGenAiResponseLoading(false);
        fileValue = [];
      }, waitTimeBeforeResponse(isLoadingPrompt));
    }, waitTimeBeforeLoading);
  };



  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', padding: '5px' }}>
      <Container
        data-testid="chat-container"
        header={<Header variant="h3">AI Assistant</Header>}
        fitHeight
        disableContentPaddings
        footer={
          <>
            <PromptInput
              ref={promptInputRef}
              onChange={({ detail }) => setPrompt(detail.value)}
              onAction={onPromptSend}
              value={prompt}
              actionButtonAriaLabel={isGenAiResponseLoading ? 'Send message button - suppressed' : 'Send message'}
              actionButtonIconName="send"
              ariaLabel={isGenAiResponseLoading ? 'Prompt input - suppressed' : 'Prompt input'}
              placeholder="Bir soru sorun..."
              autoFocus
              disableSecondaryActionsPaddings
              secondaryActions={
                <Box padding={{ left: 'xxs', top: 'xs' }}>
                  <FileInput
                    ariaLabel="Chat demo file input"
                    variant="icon"
                    multiple={true}
                    value={files}
                    onChange={({ detail }) => setFiles(prev => [...prev, ...detail.value])}
                  />
                </Box>
              }
              secondaryContent={
                areFilesDragging ? (
                  <FileDropzone onChange={({ detail }) => setFiles(prev => [...prev, ...detail.value])}>
                    <SpaceBetween size="xs" alignItems="center">
                      <Icon name="upload" />
                      <Box>Dosyaları buraya bırakın</Box>
                    </SpaceBetween>
                  </FileDropzone>
                ) : (
                  files.length > 0 && (
                    <FileTokenGroup
                      items={files.map(file => ({ file }))}
                      onDismiss={({ detail }) => {
                        setFiles(files => files.filter((_, index) => index !== detail.fileIndex));
                        if (files.length === 1) {
                          promptInputRef.current?.focus();
                        }
                      }}
                      limit={3}
                      alignment="horizontal"
                      showFileThumbnail={true}
                      i18nStrings={fileTokenGroupI18nStrings}
                    />
                  )
                )
              }
            />
            <Box color="text-body-secondary" margin={{ top: 'xs' }} fontSize="body-s">
              Bu AI asistan Mitotik Figür Tespit sistemi hakkında yardım sağlar.
            </Box>
          </>
        }
      >
        <ScrollableContainer ref={messagesContainerRef}>
          <Messages messages={messages} />
        </ScrollableContainer>
      </Container>

    </div>
  );
}
