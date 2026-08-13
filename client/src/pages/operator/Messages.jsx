import OperatorLayout from '../../components/OperatorLayout';
import MessagingCenter from '../../components/MessagingCenter';

const OperatorMessages = () => (
  <OperatorLayout fluid={true}>
    <MessagingCenter
      basePath="/operator/messages"
      emptyHint="Travellers who message you about a listing will appear here."
    />
  </OperatorLayout>
);

export default OperatorMessages;
