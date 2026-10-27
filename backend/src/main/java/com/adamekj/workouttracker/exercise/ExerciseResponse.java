package com.adamekj.workouttracker.exercise;

import java.util.List;

public record ExerciseResponse(
        Long id,
        String name,
        List<String> muscleGroups
) {
}