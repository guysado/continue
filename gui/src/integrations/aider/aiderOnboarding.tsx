import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Button } from '../../components';
import { getLocalStorage, setLocalStorage } from '../../util/localStorage';

const OnboardingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 2rem;
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 2rem;
  color: ${props => props.theme.textColor};
`;

const Description = styled.p`
  font-size: 1.2rem;
  line-height: 1.6;
  margin-bottom: 2rem;
  color: ${props => props.theme.secondaryText};
`;

const FeatureList = styled.ul`
  list-style-type: none;
  padding: 0;
  margin-bottom: 2rem;
  text-align: left;
`;

const FeatureItem = styled.li`
  font-size: 1.1rem;
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  position: relative;

  &:before {
    content: "→";
    position: absolute;
    left: 0;
  }
`;

const StartButton = styled(Button)`
  padding: 1rem 2rem;
  font-size: 1.2rem;
`;

const AiderOnboarding = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    setLocalStorage('hasSeenAiderOnboarding', true);
    navigate('/aiderMode');
  };

  return (
    <OnboardingContainer>
      <Title>Welcome to PearAI Creator</Title>
      <Description>
        Your AI-powered coding companion that helps you build and modify your projects effortlessly.
        Just describe what you want to create or change, and we'll handle the implementation.
      </Description>

      <FeatureList>
        <FeatureItem>Create new features by describing them in plain English</FeatureItem>
        <FeatureItem>Fix bugs and improve existing code naturally</FeatureItem>
        <FeatureItem>Refactor and optimize your codebase effortlessly</FeatureItem>
        <FeatureItem>Get intelligent suggestions and solutions</FeatureItem>
      </FeatureList>

      <StartButton onClick={handleStart}>
        Okay! Let's start creating
      </StartButton>
    </OnboardingContainer>
  );
};

export default AiderOnboarding;
