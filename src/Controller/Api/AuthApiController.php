<?php

namespace App\Controller\Api;

use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api')]
class AuthApiController extends AbstractController
{
    #[Route('/login', name: 'api_login', methods: ['POST'])]
    public function login(): Response
    {
        // Ha ide eljutunk, akkor a user már autentikálva van
        /** @var User|null $user */
        $user = $this->getUser();

        if (!$user) {
            return $this->json(['error' => 'Invalid credentials'], Response::HTTP_UNAUTHORIZED);
        }

        return $this->json([
            'message' => 'Login successful',
            'user' => [
                'email' => $user->getEmail(),
                'roles' => $user->getRoles(),
            ]
        ]);
    }
}
