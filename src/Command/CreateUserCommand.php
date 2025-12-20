<?php

namespace App\Command;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(name: 'app:user:create', description: 'Create a new user with username, email and password')]
class CreateUserCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('username', InputArgument::REQUIRED, 'Username for the new user')
            ->addArgument('email', InputArgument::REQUIRED, 'Email for the new user')
            ->addArgument('password', InputArgument::REQUIRED, 'Plain password for the new user');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $username = (string) $input->getArgument('username');
        $email = (string) $input->getArgument('email');
        $plainPassword = (string) $input->getArgument('password');

        // Check existing user by username or email
        $repo = $this->em->getRepository(User::class);
        $existingByUsername = $repo->findOneBy(['username' => $username]);
        $existingByEmail = $repo->findOneBy(['email' => $email]);
        if ($existingByUsername) {
            $io->error(sprintf('Username "%s" is already taken.', $username));
            return Command::FAILURE;
        }
        if ($existingByEmail) {
            $io->error(sprintf('Email "%s" is already in use.', $email));
            return Command::FAILURE;
        }

        $user = new User();
        $user->setUsername($username);
        $user->setEmail($email);
        // Default roles: empty array, ROLE_USER ensured by getRoles()
        $hashed = $this->passwordHasher->hashPassword($user, $plainPassword);
        $user->setPassword($hashed);

        $this->em->persist($user);
        $this->em->flush();

        $io->success(sprintf('User "%s" created (id: %d).', $username, $user->getId()));
        return Command::SUCCESS;
    }
}
