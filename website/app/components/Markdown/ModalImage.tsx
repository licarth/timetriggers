import {
  Center,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { smallCaps } from '~/utils/smallCaps';

export type ModalImageProps = {
  src: string;
  title?: string;
  alt?: string;
};

export const ModalImage = ({ title, src, alt }: ModalImageProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Center>
        <Stack m="auto">
          <Image
            onClick={onOpen}
            src={src}
            w={{ base: 'full', lg: 'lg' }}
            alt={alt}
            cursor="pointer"
          />
          {title && <Text mt="0">{smallCaps(title)}</Text>}
        </Stack>
      </Center>

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{smallCaps(title || '')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Image onClick={onOpen} src={src} alt={alt} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};
