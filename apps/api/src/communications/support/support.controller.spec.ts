import { SupportAssistantService } from './support-assistant.service';
import { SupportController } from './support.controller';

describe('SupportController', () => {
  it('delegates the validated question to the bounded assistant', () => {
    const response = {
      intent: 'GENERAL' as const,
      answer: 'Réponse institutionnelle',
      humanHandoff: true,
      actions: [],
      safeguards: { accountDataDisclosed: false as const, stateChanged: false as const },
    };
    const assistant = {
      answer: jest.fn().mockReturnValue(response),
    } as unknown as SupportAssistantService;
    const controller = new SupportController(assistant);

    expect(controller.ask({ question: 'Comment obtenir de l’aide ?' })).toEqual(response);
    expect(assistant.answer).toHaveBeenCalledWith('Comment obtenir de l’aide ?');
  });
});
