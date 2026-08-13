import TouristLayout from '../../components/TouristLayout';
import MessagingCenter from '../../components/MessagingCenter';

const TouristMessages = () => (
  <TouristLayout fluid={true}>
    <MessagingCenter
      basePath="/messages"
      emptyHint="Ask a host anything before you book — parking, check-in time, what's for dinner."
    />
  </TouristLayout>
);

export default TouristMessages;
