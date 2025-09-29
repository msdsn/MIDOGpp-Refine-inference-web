import React from 'react';
import { useNavigate } from 'react-router-dom';
//import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Button
} from '@cloudscape-design/components';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const DashboardPage: React.FC = () => {
  //const { user } = useAuth();
  const navigate = useNavigate();



  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        {/* Welcome Header */}
        <Header
          variant="h1"
          actions={
            <Button
              variant="primary"
              iconName="add-plus"
              onClick={() => navigate('/analyze')}
            >
              New Analysis
            </Button>
          }
          description={`Fast, Consistent, and Accurate Mitotic Figure Detection`}
        >
          PathoMito
        </Header>

        

        {/* Advanced AI Technology Section */}
        <div className="info-section mb-2">
          {/* Title and Subtitle */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-1 leading-tight">
              Advanced AI Technology
            </h2>
            <h3 className="text-2xl font-semibold text-gray-700 leading-tight">
              Precision in Digital Pathology
            </h3>
          </div>
          
          {/* Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Text Content */}
            <div className="text-content article-font max-w-prose">
              <div className="prose prose-gray max-w-none">
                <p className="text-justify mb-5 first-letter:text-4xl first-letter:font-bold first-letter:mr-1 first-letter:float-left first-letter:leading-none">
                  PathoMito leverages <span className="gradient-text-blue font-medium">state-of-the-art artificial intelligence</span> to automate mitotic figure detection, 
                  a critical step in cancer grading and histopathology. Our model is trained on the comprehensive <em>MIDOG++</em> dataset<sup>1</sup>, 
                  covering <span className="font-medium text-gray-700">503 histological specimens</span> across seven distinct tumor types with 
                  <span className="font-medium text-gray-700"> 11,937 meticulously annotated mitotic figures</span>, ensuring robust performance across 
                  diverse tissue morphologies, staining protocols, and imaging devices.
                </p>
                <p className="text-justify mb-5 indent-8">
                  Powered by the <em>YOLOv11n</em> deep learning architecture<sup>2</sup>, PathoMito delivers 
                  <span className="gradient-text-blue font-medium">rapid and reliable detection</span> of mitotic figures in 
                  whole-slide images, significantly reducing intra- and inter-observer variability while streamlining workflows for 
                  pathologists and researchers worldwide.
                </p>
                <blockquote className="gradient-large-text text-lg font-medium mt-8 pl-6 border-l-4 border-blue-300 italic">
                  PathoMito: <span className="text-base font-medium">Bringing <em className="font-semibold not-italic">speed</em>, <em className="font-semibold not-italic">accuracy</em>, and <em className="font-semibold not-italic">consistency</em> to digital pathology.</span>
                </blockquote>
              </div>
            </div>
            
            {/* Lottie Animation with Background */}
            <div className="lottie-container flex justify-center items-center">
              <div 
                className="w-80 h-80 rounded-2xl p-8 flex items-center justify-center relative overflow-hidden"
                style={{
                  backgroundImage: 'url(/mito.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <DotLottieReact
                  src="/mito.lottie"
                  loop
                  autoplay
                  className="w-full h-full relative z-10"
                />
              </div>
            </div>
          </div>
          
          {/* Divider */}
          <div className="mt-2 border-b border-gray-200"></div>
        </div>

        {/* Upload Image Section */}
        <div className="upload-section bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-2xl border border-blue-100 mb-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Upload & Analyze</h2>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Upload your H&E histopathology slide image and let our AI detect mitotic figures with state-of-the-art accuracy.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                variant="primary"
                iconName="add-plus"
                onClick={() => navigate('/analyze')}
              >
                Upload Image
              </Button>
              <Button
                variant="normal"
                iconName="file"
                onClick={() => navigate('/history')}
              >
                View History
              </Button>
            </div>
          </div>
        </div>

        {/* Mission Statement Section */}
        <div className="info-section mb-16">
          {/* Title and Subtitle */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-1 leading-tight">
              Empowering Pathologists
            </h2>
            <h3 className="text-2xl font-semibold text-gray-700 leading-tight">
              Supporting Clinical Excellence
            </h3>
          </div>
          
          {/* Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Text Content */}
            <div className="text-content article-font max-w-prose">
              <div className="prose prose-gray max-w-none">
                <p className="text-justify mb-5 first-letter:text-4xl first-letter:font-bold first-letter:mr-1 first-letter:float-left first-letter:leading-none">
                  At Pathomito, our mission is <span className="font-medium text-gray-700">to empower pathologists</span>. 
                  We provide an advanced mitosis detection framework that seamlessly integrates into pathology workflows, 
                  helping pathologists <span className="gradient-text-blue font-medium">save time, reduce error, and enhance diagnostic precision</span>.
                </p>
                <p className="text-justify indent-8">
                  By streaming our technology to clinical and research environments, we aim to support medical experts with 
                  <em> reliable, interpretable tools</em> that elevate both efficiency and confidence in decision-making processes throughout 
                  the diagnostic workflow.
                </p>
              </div>
            </div>
            
            {/* Lottie Animation */}
            <div className="lottie-container flex justify-center items-center">
              <div className="w-80 h-80 rounded-2xl bg-white p-8 flex items-center justify-center">
                <DotLottieReact
                  src="/hero_section_background_animation.lottie"
                  loop
                  autoplay
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>


        {/* References */}
        <Box margin={{ top: 'xl' }}>
          <div className="references-section bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">References</h4>
            <div className="text-xs text-gray-600 space-y-2">
              <p>
                <sup>1</sup> Aubreville, M., et al. (2023). A comprehensive multi-domain dataset for mitotic figure detection. 
                <em> Scientific Data</em>, 10, 484. <a href="https://doi.org/10.1038/s41597-023-02327-4" target="_blank" rel="noopener noreferrer">https://doi.org/10.1038/s41597-023-02327-4</a>
              </p>
              <p>
                <sup>2</sup> Jocher, G., & Qiu, J. (2024). Ultralytics YOLO11 (Version 11.0.0) [Computer software]. 
                <em> GitHub</em>. <a href="https://github.com/ultralytics/ultralytics" target="_blank" rel="noopener noreferrer">https://github.com/ultralytics/ultralytics</a>
              </p>
            </div>
          </div>
        </Box>
      </SpaceBetween>
    </Container>
  );
};

export default DashboardPage; 