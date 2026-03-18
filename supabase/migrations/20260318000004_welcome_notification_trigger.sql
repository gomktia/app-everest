-- Trigger: send welcome notification when a new student is created
CREATE OR REPLACE FUNCTION public.send_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for students
  IF NEW.role = 'student' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.id,
      'system',
      'Bem-vindo ao Everest Preparatórios! 🎉',
      'Parabéns por dar o primeiro passo na sua jornada de preparação! Explore seus cursos, flashcards e simulados para começar a estudar. Bons estudos!'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fire after insert on users table
DROP TRIGGER IF EXISTS on_new_user_welcome ON public.users;
CREATE TRIGGER on_new_user_welcome
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_notification();
