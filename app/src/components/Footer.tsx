import React from 'react';
import { Box, Container, SpaceBetween, Link } from '@cloudscape-design/components';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      padding={{ vertical: 'xl', horizontal: 'l' }}
      textAlign="center"
      margin={{ top: 'xxl' }}
    >
      <Container>
        <SpaceBetween direction="vertical" size="m">
          {/* Main Footer Content */}
          <SpaceBetween direction="horizontal" size="xl" alignItems="center">
            <Box variant="h3">
              <div style={{ color: 'rgba(0, 0, 0, 0.56)' }}>
                PathoMito
              </div>
            </Box>
            
            <SpaceBetween direction="horizontal" size="l">
              <Link href="#" fontSize="body-s">
                <span style={{ color: 'rgba(0, 0, 0, 0.56)' }}>About</span>
              </Link>
              <Link href="#" fontSize="body-s">
                <span style={{ color: 'rgba(0, 0, 0, 0.56)' }}>Research</span>
              </Link>
              <Link href="#" fontSize="body-s">
                <span style={{ color: 'rgba(0, 0, 0, 0.56)' }}>Contact</span>
              </Link>
              <Link href="#" fontSize="body-s">
                <span style={{ color: 'rgba(0, 0, 0, 0.56)' }}>Privacy Policy</span>
              </Link>
            </SpaceBetween>
          </SpaceBetween>

          {/* Academic Disclaimer */}
          <Box 
            textAlign="center"
            margin={{ top: 'l' }}
          >
            <div style={{ 
              fontSize: '11px', 
              color: 'rgba(0, 0, 0, 0.56)', 
              lineHeight: '1.4',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              <strong>Academic Research Platform - Development Version</strong>
              <br />
              This is an experimental research platform developed for academic purposes only. 
              The AI models and analysis results are provided for research and educational use. 
              This platform is not intended for clinical diagnosis or medical decision-making. 
              We do not assume any responsibility for the accuracy of results or any decisions made based on the analysis provided. 
              All results should be verified by qualified medical professionals.
              <br />
              <br />
              For research inquiries and collaboration opportunities, please contact our academic team.
            </div>
          </Box>

          {/* Copyright */}
          <Box 
            textAlign="center"
            margin={{ top: 'm' }}
          >
            <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.56)' }}>
              © {currentYear} PathoMito Research Platform. All rights reserved.
            </div>
          </Box>
        </SpaceBetween>
      </Container>
    </Box>
  );
};

export default Footer;
